#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TokUp 邮件触达脚本（2026-09-14 新增）

用途：给指定人群发送运营邮件（订阅推荐 / 激活召回）。
- 目标人群直接从生产库计算，避免手抄邮箱出错。
- 默认 dry-run；必须显式加 --send 才会真正发送。
- 发送节流 + 结果日志，避免被邮箱服务商限流。

用法（在生产机执行）：
  python3 scripts/tokup-email-campaign.py --campaign subscribe --list
  python3 scripts/tokup-email-campaign.py --campaign subscribe --send
  python3 scripts/tokup-email-campaign.py --campaign activate  --send
"""
import argparse
import os
import sqlite3
import sys
import time

DB = os.getenv("TOKUP_DB", "/opt/tokup/backend/tokup.db")
BASE = "https://tokup.net"
MIN_RECHARGE, MAX_RECHARGE = 5.0, 300.0


def q(db, sql, args=()):
    return db.execute(sql, args).fetchall()


def targets_subscribe(db):
    """已付费（¥5-300）、当前无有效订阅的用户 → 推荐订阅。"""
    rows = q(db, """
        SELECT u.email, u.token_balance, u.total_recharged,
               (SELECT MAX(s.end_date) FROM subscriptions s WHERE s.user_id=u.id) AS last_sub_end
        FROM users u
        WHERE u.is_admin=0
          AND EXISTS (SELECT 1 FROM transactions t WHERE t.user_id=u.id AND t.type='recharge'
                      AND t.status='completed' AND t.amount > 0)
          AND (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.user_id=u.id
               AND t.type='recharge' AND t.status='completed' AND t.description NOT LIKE '提成%')
              BETWEEN ? AND ?
          AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id=u.id
                          AND s.is_active=1 AND s.end_date > datetime('now'))
        GROUP BY u.id ORDER BY u.total_recharged DESC
    """, (MIN_RECHARGE, MAX_RECHARGE))
    return [dict(r) for r in rows]


def targets_activate(db):
    """已充值但近 30 天没有调用的付费用户 → 激活召回（提醒怎么用起来）。"""
    rows = q(db, """
        SELECT u.email, u.token_balance, u.total_recharged, MAX(ur.created_at) AS last_use
        FROM users u
        LEFT JOIN usage_records ur ON ur.user_id = u.id
        WHERE u.is_admin=0
          AND EXISTS (SELECT 1 FROM transactions t WHERE t.user_id=u.id AND t.type='recharge'
                      AND t.status='completed' AND t.amount > 0)
        GROUP BY u.id
        HAVING last_use IS NULL OR last_use < '2026-08-15'
        ORDER BY u.total_recharged DESC
    """)
    return [dict(r) for r in rows]


def body_subscribe(row):
    bal = int(row.get("token_balance") or 0)
    exp = ("您之前的订阅已于 %s 到期。" % str(row["last_sub_end"])[:10]) if row.get("last_sub_end") else ""
    return (
        "您好，\n\n"
        "注意到您已在 TokUp 有过消费记录，推荐开通「体验订阅」，用起来更省心：\n\n"
        "· ¥29.9 / 7 天\n"
        "· 每天 5 万 Token 免费额度（配额内不扣余额）\n"
        "· 全模型余额消费 9 折\n"
        "· 到期自动结束，不自动续费\n"
        + (exp + "\n\n" if exp else "\n")
        + "您当前余额：%d Token\n\n"
        "开通入口：%s/pricing\n\n"
        "—— TokUp 平台" % (bal, BASE)
    )


def body_activate(row):
    bal = int(row.get("token_balance") or 0)
    return (
        "您好，\n\n"
        "您的 TokUp 账户还有余额 %d Token，但最近没有使用记录。\n\n"
        "三步即可开始：\n"
        "1. 登录 %s 打开「工作台」\n"
        "2. 复制你的 API Key（或用页面内的测试聊天框直接对话）\n"
        "3. 粘贴到你常用的客户端即可\n\n"
        "如需接入教程或遇到问题，直接回复本邮件即可。\n\n"
        "—— TokUp 平台" % (bal, BASE)
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--campaign", choices=["subscribe", "activate"], required=True)
    ap.add_argument("--send", action="store_true", help="真正发送（默认只列出，不发送）")
    ap.add_argument("--list", action="store_true", help="只列出目标人群")
    ap.add_argument("--limit", type=int, default=0, help="最多发送人数（0=不限）")
    ap.add_argument("--sleep", type=float, default=3.0, help="每封间隔秒数")
    args = ap.parse_args()

    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    rows = targets_subscribe(db) if args.campaign == "subscribe" else targets_activate(db)
    if args.limit:
        rows = rows[:args.limit]

    print("=" * 60)
    print("TokUp 邮件触达 | 活动=%s | 目标人数=%d | 模式=%s"
          % (args.campaign, len(rows), "发送" if args.send else "dry-run"))
    print("=" * 60)
    for r in rows:
        print("  %-32s 余额=%-8d 累计充值=%.2f" % (r["email"], int(r["token_balance"] or 0), r["total_recharged"] or 0))
    if args.list or not args.send:
        print("\n（未发送。加 --send 才会真正发送）")
        return 0

    sys.path.insert(0, "/opt/tokup/backend")
    from services.email_notify import is_enabled, send_email
    if not is_enabled():
        print("❌ SMTP 未配置，未发送")
        return 1

    subject = "【TokUp】¥29.9 体验订阅：每天 5 万 Token 免费" if args.campaign == "subscribe" \
        else "【TokUp】你的账户还有余额，三步就能用起来"
    ok = fail = 0
    for i, r in enumerate(rows, 1):
        body = body_subscribe(r) if args.campaign == "subscribe" else body_activate(r)
        good = send_email(r["email"], subject, body)
        ok += 1 if good else 0
        fail += 0 if good else 1
        print("  [%d/%d] %s %s" % (i, len(rows), "OK " if good else "FAIL", r["email"]))
        if i < len(rows):
            time.sleep(max(0.5, args.sleep))
    print("\n发送完成：成功 %d，失败 %d" % (ok, fail))
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
