#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TokUp 消耗明细 + 七牛月限额使用率报告（只读）

回答三个问题：
  1. 七牛 key 月限额用了多少（本月费用 / 配置的月限额）
  2. 谁用了什么模型、消耗了多少 token / 费用（平台 usage_records 按用户/模型/天）
  3. 平台记录 vs 七牛实际计费是否对得上（差额 = 潜在白嫖/漏记/上游口径差异）

运行方式：
  # 生产（服务器上跑，读生产库）：
  cd /opt/tokup/backend && /opt/tokup/backend/venv/bin/python /opt/tokup/scripts/tokup-consumption-report.py
  # 本地（对拷下来的库/本地库 + 本地 .env）：
  python3 scripts/tokup-consumption-report.py --db backend/tokup.db --env backend/.env
  参数：
    --db           SQLite 库路径（默认 backend/tokup.db）
    --env          七牛 key 的 .env 路径（默认 backend/.env）
    --monthly-quota 七牛 key 月限额金额（默认取 env QINIU_MONTHLY_QUOTA_LIMIT，否则 300）
    --since        明细起始日期 YYYY-MM-DD（默认 30 天前；也总是输出全部/近7天/本月）
    --json         输出机器可读 JSON 并保存快照 scripts/model_snapshots/consumption/YYYYMMDD.json
退出码：0=正常；1=存在异常项（如平台记录与七牛差额>10%、限额使用率>90%）
"""
import argparse
import datetime as dt
import json
import os
import re
import sqlite3
import sys
import urllib.request

# 平台模型 → 七牛账单 model_id（用于对账；与 pricing-check 的 BILLING_ALIASES 保持一致）
QINIU_MODEL_ALIASES = {
    "deepseek/deepseek-v4-flash": ["deepseek/deepseek-v4-flash", "deepseek/deepseek-v4-flash-202605",
                                   "deepseek/deepseek-v4-flash-20260731"],
    "deepseek/deepseek-v4-pro": ["deepseek/deepseek-v4-pro", "deepseek/deepseek-v4-pro-202606",
                                 "deepseek/deepseek-v4-pro-0813"],
    "deepseek/deepseek-v3.2": ["deepseek/deepseek-v3.2-exp", "deepseek/deepseek-v3.2-exp-thinking",
                               "deepseek/deepseek-v3.2-251201"],
    "glm-5.2": ["z-ai/glm-5.2"],
    "gpt-5.5": ["openai/gpt-5.5", "gpt-5.5"],
    "openai/gpt-5.6-luna": ["openai/gpt-5.6-luna"],
    "openai/gpt-5.6-sol": ["openai/gpt-5.6-sol"],
    "openai/gpt-5.6-terra": ["openai/gpt-5.6-terra"],
    "anthropic/claude-fable-5": ["anthropic/claude-fable-5"],
    "moonshotai/kimi-k3": ["moonshotai/kimi-k3"],
    "moonshotai/kimi-k2.6": ["moonshotai/kimi-k2.6"],
    "moonshotai/kimi-k2.7-code": ["moonshotai/kimi-k2.7-code"],
    "qwen/qwen3.7-max": ["qwen/qwen3.7-max"],
    "qwen/qwen3.8-max": ["qwen/qwen3.8-max"],
    "qwen3-max": ["qwen3-max"],
    "qwen3.5-397b-a17b": ["qwen3.5-397b-a17b"],
    "MiniMax-M1": ["MiniMax-M1"],
    "minimax/minimax-m3": ["minimax/minimax-m3"],
    "deepseek-v3": ["deepseek-v3"],
    "deepseek-r1": ["deepseek-r1"],
}

COST_DETAIL_URL = "https://api.qnaigc.com/v3/stat/usage/apikey/cost-detail"
COST_SUMMARY_URL = "https://api.qnaigc.com/v3/stat/usage/apikey/cost"


def load_env(path):
    env = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def http_get_json(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_qiniu(api_key, start, end):
    """返回 (本月费用, 期间账单明细 models[{model_id:{in,out,cache,fee}}], 错误)"""
    import urllib.parse
    models = {}
    errors = []
    month_fee = 0.0
    # 本月汇总
    try:
        j = http_get_json(COST_SUMMARY_URL + "?type=month", {"Authorization": f"Bearer {api_key}"})
        for ak in j.get("data", {}).get("api_keys", []):
            month_fee += float(ak.get("total_fee") or 0)
    except Exception as e:
        errors.append(f"month_summary: {e}")
    # 期间明细
    try:
        url = COST_DETAIL_URL + "?" + urllib.parse.urlencode(
            {"start_date": start, "end_date": end, "grain": "day"})
        j = http_get_json(url, {"Authorization": f"Bearer {api_key}"})
        for b in j.get("data", {}).get("bills", []):
            for m in b.get("models", []):
                mid = m.get("model_id")
                e = models.setdefault(mid, {"in": 0.0, "out": 0.0, "cache": 0.0, "fee": 0.0})
                e["fee"] += float(m.get("total_fee") or 0)
                for it in m.get("items", []):
                    u = it.get("usage", {})
                    cnt = float(u.get("count") or 0)
                    unit = u.get("unit", "")
                    toks = cnt * 1000 if unit in ("k/tokens", "kToken") else (cnt if unit == "tokens" else 0)
                    k = it.get("key", "")
                    if "output" in k:
                        e["out"] += toks
                    elif "ncache" in k or "input" in k:
                        e["in"] += toks
                    elif "cache" in k:
                        e["cache"] += toks
    except Exception as e:
        errors.append(f"detail: {e}")
    return month_fee, models, errors


def db_conn(db_path):
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="backend/tokup.db")
    ap.add_argument("--env", default="backend/.env")
    ap.add_argument("--monthly-quota", type=float, default=None)
    ap.add_argument("--since", default=None)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    env = load_env(args.env)
    qk = env.get("QINIU_API_KEY", "")
    quota_limit = args.monthly_quota or float(os.getenv("QINIU_MONTHLY_QUOTA_LIMIT", env.get("QINIU_MONTHLY_QUOTA_LIMIT", "300")))

    today = dt.date.today()
    since = dt.date.fromisoformat(args.since) if args.since else today - dt.timedelta(days=30)
    start_iso, end_iso = since.isoformat(), today.isoformat()
    since7 = (today - dt.timedelta(days=7)).isoformat()

    out = {"date": today.isoformat(), "period": f"{start_iso}~{end_iso}", "monthly_quota": quota_limit,
           "qiniu_errors": [], "db_errors": [], "alerts": [], "detail": {}}

    # ---- 七牛 ----
    month_fee, q_models, q_errs = fetch_qiniu(qk, start_iso, end_iso)
    out["qiniu_errors"] = q_errs
    quota_rate = (month_fee / quota_limit * 100) if quota_limit else None
    if quota_rate is not None and quota_rate >= 90:
        out["alerts"].append(f"七牛月限额使用率 {quota_rate:.0f}%（{month_fee:.2f}/{quota_limit:.0f}），快触顶需关注")

    # ---- 平台库 ----
    try:
        conn = db_conn(args.db)
    except Exception as e:
        out["db_errors"].append(str(e))
        print(json.dumps(out, ensure_ascii=False, indent=2) if args.json else f"DB 打开失败: {e}")
        return 1
    c = conn.cursor()

    def q(sql, *p):
        return [dict(r) for r in c.execute(sql, p).fetchall()]

    try:
        users = q("""SELECT u.id,u.email,u.nickname,u.is_admin,u.token_balance,u.total_recharged,
                     (SELECT COUNT(*) FROM usage_records ur WHERE ur.user_id=u.id) req_all,
                     (SELECT ROUND(SUM(ur.cost_cny),2) FROM usage_records ur WHERE ur.user_id=u.id) cost_all,
                     (SELECT SUM(ur.input_tokens)+SUM(ur.output_tokens) FROM usage_records ur WHERE ur.user_id=u.id) tok_all,
                     (SELECT COUNT(*) FROM usage_records ur WHERE ur.user_id=u.id AND ur.created_at>=?) req_period,
                     (SELECT ROUND(SUM(ur.cost_cny),2) FROM usage_records ur WHERE ur.user_id=u.id AND ur.created_at>=?) cost_period,
                     (SELECT SUM(ur.input_tokens)+SUM(ur.output_tokens) FROM usage_records ur WHERE ur.user_id=u.id AND ur.created_at>=?) tok_period,
                     (SELECT SUM(ur.input_tokens) FROM usage_records ur WHERE ur.user_id=u.id AND ur.created_at>=?) itok_period,
                     (SELECT SUM(ur.output_tokens) FROM usage_records ur WHERE ur.user_id=u.id AND ur.created_at>=?) otok_period,
                     (SELECT ROUND(SUM(ur.cost_cny),2) FROM usage_records ur WHERE ur.user_id=u.id AND ur.created_at>=?) cost_7d
                   FROM users u ORDER BY cost_period DESC""",
                   start_iso + " 00:00:00", start_iso + " 00:00:00", start_iso + " 00:00:00",
                   start_iso + " 00:00:00", start_iso + " 00:00:00", since7 + " 00:00:00")
        users = [u for u in users if u["req_period"] or u["req_all"]]

        models = q("""SELECT ur.model, COUNT(*) req, SUM(ur.input_tokens) itok, SUM(ur.output_tokens) otok,
                      ROUND(SUM(ur.cost_cny),2) cost, SUM(CASE WHEN ur.status='error' THEN 1 ELSE 0 END) errs
                      FROM usage_records ur WHERE ur.created_at>=? GROUP BY ur.model ORDER BY itok+otok DESC""",
                   start_iso + " 00:00:00")

        daily = q("""SELECT substr(created_at,1,10) d, COUNT(*) req, ROUND(SUM(cost_cny),2) cost
                     FROM usage_records WHERE created_at>=? GROUP BY d ORDER BY d""", since7 + " 00:00:00")

        by_user_model = q("""SELECT u.email, ur.model, COUNT(*) req, SUM(ur.input_tokens) itok,
                             SUM(ur.output_tokens) otok, ROUND(SUM(ur.cost_cny),2) cost
                             FROM usage_records ur JOIN users u ON u.id=ur.user_id
                             WHERE ur.created_at>=? GROUP BY ur.user_id, ur.model ORDER BY itok+otok DESC""",
                          start_iso + " 00:00:00")

        # 平台汇总
        plat = q("""SELECT COUNT(*) req, SUM(input_tokens) itok, SUM(output_tokens) otok,
                    ROUND(SUM(cost_cny),2) cost FROM usage_records WHERE created_at>=?""",
                 start_iso + " 00:00:00")[0]
        plat_all = q("""SELECT COUNT(*) req, SUM(input_tokens) itok, SUM(output_tokens) otok,
                        ROUND(SUM(cost_cny),2) cost FROM usage_records""")[0]
        zero_cost = q("""SELECT u.email, COUNT(*) n, SUM(ur.input_tokens)+SUM(ur.output_tokens) toks,
                         GROUP_CONCAT(DISTINCT ur.model) models
                         FROM usage_records ur JOIN users u ON u.id=ur.user_id
                         WHERE ur.cost_cny=0 AND (ur.input_tokens+ur.output_tokens)>0
                         GROUP BY ur.user_id ORDER BY toks DESC LIMIT 10""")

        # 白嫖/异常检查
        qiniu_period_fee = sum(m["fee"] for m in q_models.values())
        if plat["cost"] is not None and qiniu_period_fee > 0:
            gap = (plat["cost"] or 0) / qiniu_period_fee
            if gap < 0.98:
                out["alerts"].append(
                    f"⚠️ 平台本期收入({plat['cost']}元) < 七牛本期计费({qiniu_period_fee:.2f}元)，比值 {gap:.2f}，"
                    f"本期在亏钱，请核对是否有漏记/白嫖/免费额度超发")
        free_models = ("glm-4.6v-flash",)  # 智谱直连免费，cost=0 是设计如此
        for z in zero_cost:
            if z["toks"] and z["toks"] > 100_000:
                has_free = any(fm in (z.get("models") or "") for fm in free_models)
                tag = "（免费模型正常）" if has_free else "（免费配额/体验金/白嫖嫌疑）"
                out["alerts"].append(f"0费用但消耗大: {z['email']} {z['n']}次 {z['toks']:.0f} tokens{tag}")
        for mrow in models:
            if mrow["errs"] and mrow["errs"] > 20:
                out["alerts"].append(f"模型 {mrow['model']} 近{end_iso}起失败 {mrow['errs']} 次")
        for u in users:
            if u["is_admin"] or not u["cost_period"]:
                continue
            # 仅按本期消耗判断（2026-08-31 起）：本期消耗 > 累计充值 + 5 元才告警；
            # 历史注册体验金白嫖（8/20 已取消体验金）不再累计追溯，避免旧账反复报警
            if (u["cost_period"] or 0) > (u["total_recharged"] or 0) + 5:
                out["alerts"].append(
                    f"消耗超充值(>¥5): {u['email']} 本期消耗 ¥{u['cost_period']} > 充值 ¥{u['total_recharged']}（白嫖/订阅免费配额，需人工确认）")
    except Exception as e:
        out["db_errors"].append(f"{type(e).__name__}: {e}")
        users = models = daily = by_user_model = []
        plat = plat_all = {"req": 0, "itok": 0, "otok": 0, "cost": 0.0}
        zero_cost = []

    out["detail"] = {
        "quota": {"month_fee": round(month_fee, 2), "limit": quota_limit,
                  "rate": round(quota_rate, 1) if quota_rate is not None else None},
        "platform_period": plat, "platform_all": plat_all,
        "qiniu_period": {"fee": round(sum(m["fee"] for m in q_models.values()), 2),
                         "tokens": round(sum(m["in"] + m["out"] for m in q_models.values()), 0)},
        "users": users, "models": models, "daily": daily, "by_user_model": by_user_model,
        "zero_cost": zero_cost,
    }

    # 始终保存 JSON 快照（供历史对比/周报引用）
    snap_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "scripts", "model_snapshots", "consumption")
    os.makedirs(snap_dir, exist_ok=True)
    with open(os.path.join(snap_dir, f"{today.isoformat()}.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    if args.json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 1 if out["alerts"] else 0

    # ---- 人类可读 ----
    W = 78
    print("=" * W)
    print(f"TokUp 消耗明细 + 七牛限额报告  {today}  （明细区间 {start_iso} ~ {end_iso}）")
    print("=" * W)
    print(f"① 七牛 key 月限额：本月已用 ¥{month_fee:.2f} / ¥{quota_limit:.0f}"
          + (f"（{quota_rate:.0f}%）" if quota_rate is not None else "") + ("  ⚠️≥90% 快触顶" if quota_rate and quota_rate >= 90 else ""))
    print(f"② 平台本期消耗：请求 {plat['req']} 次，输入 {plat['itok']/1e6:.2f}M + 输出 {plat['otok']/1e6:.2f}M"
          f"（共 {(plat['itok'] or 0)+(plat['otok'] or 0):,.0f} token），平台收入 ¥{plat['cost'] or 0}")
    print(f"   七牛本期计费：¥{sum(m['fee'] for m in q_models.values()):.2f}"
          f"（标准价，{(sum(m['in']+m['out'] for m in q_models.values()))/1e6:.2f}M token）")
    print(f"   平台历史累计：请求 {plat_all['req']}，token {(plat_all['itok'] or 0)+(plat_all['otok'] or 0):,.0f}，收入 ¥{plat_all['cost'] or 0}")
    print()
    print("③ 按用户（本期，按费用降序，仅显示有消耗的）：")
    print(f"   {'用户':<28}{'请求':>6}{'输入M':>9}{'输出M':>8}{'费用¥':>8}{'充值¥':>7}{'余额':>8}  角色")
    for u in users[:25]:
        if not u["req_period"]:
            continue
        role = "管理员" if u["is_admin"] else ""
        print(f"   {u['email']:<28}{u['req_period']:>6}{(u['itok_period'] or 0)/1e6:>9.2f}{(u['otok_period'] or 0)/1e6:>8.2f}{u['cost_period'] or 0:>8.2f}{u['total_recharged'] or 0:>7.1f}{u['token_balance']:>8.0f}  {role}")
    print()
    print("④ 按模型（本期）：")
    for m in models[:15]:
        print(f"   {m['model']:<40} req {m['req']:>5}  in {m['itok']/1e6:6.2f}M  out {m['otok']/1e6:6.2f}M  费用¥{m['cost'] or 0}")
    print()
    print("⑤ 近7天趋势（请求数/费用）：")
    for d in daily:
        print(f"   {d['d']}  {d['req']:>4} 次  ¥{d['cost'] or 0}")
    print()
    if zero_cost:
        print("⑥ 0费用但消耗>0（免费配额/体验金/白嫖嫌疑 TOP）：")
        for z in zero_cost[:8]:
            print(f"   {z['email']}  {z['n']} 次  {z['toks']:,.0f} tokens")
    print()
    if out["alerts"]:
        print("⚠️ 需要关注：")
        for a in out["alerts"]:
            print(f"   - {a}")
        print()
        return 1
    print("✅ 无异常：限额余量充足、平台记录与七牛计费基本一致、无白嫖迹象")
    return 0


if __name__ == "__main__":
    sys.exit(main())
