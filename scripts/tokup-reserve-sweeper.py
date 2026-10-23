#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""预扣台账扫尾：把超时仍未结算的预扣自动退回。

背景：预扣(reserve_token)后若请求被取消/断连，部分代码路径可能漏结算，
用户余额被无声冻结（2026-10-14 首次发现，24 人 ¥419；10-21/10-23 又复发）。
本脚本按 reserve_log 台账兜底：pending 超过 --minutes 的预扣一律退回并留审计流水。

用法：
  python3 scripts/tokup-reserve-sweeper.py --db /opt/tokup/backend/tokup.db --minutes 15
  python3 scripts/tokup-reserve-sweeper.py --dry-run        # 只看不扣
退出码：0 正常
"""
import argparse
import datetime as dt
import sqlite3
import sys
import uuid

DEFAULT_DB = "/opt/tokup/backend/tokup.db"
REASON = "余额修正：预扣超时自动退回"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--minutes", type=int, default=15)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    now_s = now.strftime("%Y-%m-%d %H:%M:%S")
    cutoff = (now - dt.timedelta(minutes=args.minutes)).strftime("%Y-%m-%d %H:%M:%S")

    con = sqlite3.connect(args.db, timeout=30)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    try:
        cur.execute("BEGIN IMMEDIATE")  # 与结算路径串行化，避免重复退款
    except sqlite3.OperationalError as e:
        print(f"SKIP lock: {e}")
        return 0

    rows = cur.execute(
        "SELECT id,user_id,amount,description,created_at FROM reserve_log "
        "WHERE status='pending' AND datetime(created_at) < datetime(?)",
        (cutoff,),
    ).fetchall()

    if not rows:
        con.commit()
        print(f"OK 无超时预扣（cutoff {cutoff}）")
        return 0

    if args.dry_run:
        con.rollback()
        for r in rows:
            print(f"[dry] user={r['user_id']} amount={r['amount']} created={r['created_at']} desc={r['description']}")
        return 0

    total = 0.0
    for r in rows:
        amt = float(r["amount"] or 0)
        if amt <= 0:
            cur.execute("UPDATE reserve_log SET status='refunded', closed_at=? WHERE id=? AND status='pending'", (now_s, r["id"]))
            continue
        cur.execute(
            "UPDATE users SET token_balance=token_balance+?, updated_at=? WHERE id=?",
            (amt, now_s, r["user_id"]),
        )
        cur.execute(
            "UPDATE reserve_log SET status='refunded', closed_at=? WHERE id=? AND status='pending'",
            (now_s, r["id"]),
        )
        cur.execute(
            """INSERT INTO transactions
               (id,user_id,amount,token_amount,type,status,payment_method,payment_id,description,created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (str(uuid.uuid4()), r["user_id"], amt / 100.0, amt,
             "correction", "completed", "system-correction", "", REASON, now_s),
        )
        total += amt
    con.commit()
    print(f"REFUNDED {len(rows)} 笔，合计 ¥{total/100:.2f}")
    if total >= 100:  # 单次退回 ≥¥1 时输出可被监控捕获的标记
        print(f"RESERVE_LEAK_ALERT amount_fen={total:.0f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
