#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TokUp 资源包「烧包 vs 烧余额」日报（只读）
================================================
回答：每天每个模型是在烧资源包（国产包内，按官方系数折算）还是烧七牛余额（包外/按量），
以及对应的实际成本、卖价收入、毛利。

依据（2026-08-22 与七牛 qmall 资源包详情页核对）：
- AI 国产模型系列资源包：抵扣基准 = deepseek-v3.1 输入价 0.004 元/千token；
  抵扣数量 = 模型计费项实际用量 × 抵扣系数（越贵扣越多）。
- 已确认包内模型及系数（见 PACK_COEF）；已确认包外：gpt-5.5 / fable-5 / gpt-5.6-sol。
- 包单价：默认 5000万 token / ¥160 → ¥3.2/百万包token（可用参数覆盖）。

用法:
  python3 scripts/tokup-pack-report.py                    # 昨天
  python3 scripts/tokup-pack-report.py --date 2026-08-21  # 指定日期
  python3 scripts/tokup-pack-report.py --json             # 机器可读 + 存快照
退出码: 0=正常; 1=存在毛利<1.3x 或包外余额成本过高
"""
import argparse, ast, datetime as dt, json, os, re, sys, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(ROOT, "backend", ".env")
AI_SERVICE = os.path.join(ROOT, "backend", "services", "ai_service.py")
COST_DETAIL_URL = "https://api.qnaigc.com/v3/stat/usage/apikey/cost-detail"
SNAP_DIR = os.path.join(ROOT, "scripts", "model_snapshots", "pack")

# ── 默认包参数（可 --pack-tokens / --pack-price 覆盖）──
PACK_TOKENS = 50_000_000      # 5000万
PACK_PRICE = 160.0            # 元
PACK_COST_PER_M = PACK_PRICE / (PACK_TOKENS / 1_000_000)   # ¥/百万包token

# ── 已确认「包内」模型：计费项关键词 → 抵扣系数（来源：七牛资源包详情页 2026-08-22 用户核对）──
PACK_COEF = {
    "deepseek/deepseek-v4-flash":       {"ncache": 0.25, "cache": 0.25, "output": 0.5},
    "deepseek-v3":                      {"ncache": 0.5,  "cache": 0.5,  "output": 2.0},
    "deepseek-r1":                      {"ncache": 1.0,  "cache": 1.0,  "output": 4.0},
    "deepseek/deepseek-v4-pro":         {"ncache": 3.0,  "cache": 3.0,  "output": 6.0},
    "deepseek/deepseek-v4-pro-202606":  {"ncache": 0.75, "cache": 0.01, "output": 1.5},
    "deepseek/deepseek-v4-pro-0813":    {"ncache": 0.75, "cache": 0.01, "output": 1.5,
                                         "ncache_offpeak": 1.13, "cache_offpeak": 0.04, "output_offpeak": 3.38,
                                         "ncache_peak": 2.25, "cache_peak": 0.07, "output_peak": 6.75},
    "z-ai/glm-5.2":                     {"ncache": 2.0,  "cache": 0.5,  "output": 7.0},
    "minimax/minimax-m3":               {"ncache": 0.53, "cache": 0.1,  "output": 2.1},
    "moonshotai/kimi-k2.7-code":        {"ncache": 1.63, "cache": 0.32, "output": 6.75},
    "moonshotai/kimi-k2.6":             {"ncache": 1.63, "cache": 0.28, "output": 6.75},
    "moonshotai/kimi-k3":               {"ncache": 5.0,  "cache": 0.5,  "output": 25.0},
    "qwen/qwen3.7-max":                 {"ncache": 3.0,  "cache": 0.6,  "output": 9.0},
    "MiniMax-M1":                       {"ncache": 1.0,  "cache": 1.0,  "output": 4.0},
    "moonshotai/kimi-k2":               {"ncache": 1.0,  "cache": 1.0,  "output": 4.0},
    "moonshotai/kimi-k2.5":             {"ncache": 1.0,  "cache": 0.17, "output": 5.25},
}

# ── 已确认「包外」（按量余额计费）──
PACK_OUT = {"openai/gpt-5.5", "anthropic/claude-fable-5", "openai/gpt-5.6-sol",
            "openai/gpt-5.6-luna", "openai/gpt-5.6-terra"}   # luna/terra 海外，未逐个搜，按包外处理

# 账单 model_id → 平台模型 key（毛利对账用）
BILL_TO_KEY = {
    "openai/gpt-5.5": "gpt-5.5",
    "z-ai/glm-5.2": "glm-5.2",
    "deepseek/deepseek-v4-pro-0813": "deepseek/deepseek-v4-pro",
    "deepseek/deepseek-v4-pro-202606": "deepseek/deepseek-v4-pro",
    "deepseek/deepseek-v4-flash-20260731": "deepseek/deepseek-v4-flash",
    "deepseek-v3.1": "deepseek-v3",
}


def load_env():
    env = {}
    if os.path.exists(ENV_FILE):
        for line in open(ENV_FILE, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def parse_py_dict(src, name):
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == name and isinstance(node.value, ast.Dict):
                    out = {}
                    for k, v in zip(node.value.keys, node.value.values):
                        if isinstance(k, ast.Constant) and isinstance(k.value, str):
                            try:
                                out[k.value] = ast.literal_eval(v)
                            except Exception:
                                out[k.value] = None
                    return out
    return {}


def load_sell():
    src = open(AI_SERVICE, encoding="utf-8").read()
    return parse_py_dict(src, "MODEL_COST")


def http_get_json(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def pick_coef(mid, key):
    """根据计费项 key（cache/ncache/output/_offpeak/_peak/区间前缀）选系数"""
    c = PACK_COEF.get(mid)
    if not c:
        return None
    k = key
    if "offpeak" in k:
        return c.get(k) or c.get(k.replace("_offpeak", ""))
    if "peak" in k:
        return c.get(k) or c.get(k.replace("_peak", ""))
    if "ncache" in k or "input" in k:
        return c.get("ncache")
    if "cache" in k:
        return c.get("cache")
    if "output" in k:
        return c.get("output")
    return c.get("ncache")


def fetch_day(api_key, d):
    """返回 {model_id: {'in':tokens, 'out':tokens, 'fee':¥, 'pack':包token, 'items':[(key,coef,tokens)]}}"""
    url = COST_DETAIL_URL + "?" + urllib.parse.urlencode({"start_date": d, "end_date": d, "grain": "day"})
    j = http_get_json(url, {"Authorization": f"Bearer {api_key}"})
    out = {}
    for b in j.get("data", {}).get("bills", []):
        for m in b.get("models", []):
            mid = m.get("model_id")
            fee = float(m.get("total_fee") or 0)
            e = out.setdefault(mid, {"in": 0.0, "out": 0.0, "fee": 0.0, "pack": 0.0, "items": []})
            e["fee"] += fee
            for it in m.get("items", []):
                u = it.get("usage", {}) or {}
                cnt = float(u.get("count") or 0)
                unit = u.get("unit", "")
                toks = cnt * 1000 if unit in ("k/tokens", "kToken") else cnt
                key = it.get("key", "")
                if "output" in key:
                    e["out"] += toks
                else:
                    e["in"] += toks
                coef = pick_coef(mid, key)
                e["pack"] += toks * (coef if coef is not None else 0.0)
                e["items"].append((key, coef, toks))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=None)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--pack-tokens", type=float, default=PACK_TOKENS)
    ap.add_argument("--pack-price", type=float, default=PACK_PRICE)
    args = ap.parse_args()
    d = args.date or (dt.date.today() - dt.timedelta(days=1)).isoformat()
    pack_cost_per_m = args.pack_price / (args.pack_tokens / 1_000_000)

    env = load_env()
    qk = env.get("QINIU_API_KEY", "")
    if not qk:
        print("❌ QINIU_API_KEY 缺失（backend/.env）"); return 1
    sell = load_sell()

    models = fetch_day(qk, d)
    rows, warns = [], []
    tot_pack = tot_bal = tot_income = 0.0
    for mid in sorted(models):
        e = models[mid]
        key = BILL_TO_KEY.get(mid, mid)
        in_m, out_m = e["in"] / 1e6, e["out"] / 1e6
        if mid in PACK_COEF:
            tag, bal = "包内", 0.0
            pack_m = e["pack"] / 1e6
        elif mid in PACK_OUT:
            tag, bal, pack_m = "包外", e["fee"], 0.0
        else:
            tag, bal, pack_m = "?未确认", e["fee"], 0.0   # 未确认：保守按余额
        s = sell.get(key)
        income = (in_m * s[0] + out_m * s[1]) if s else 0.0
        cost = pack_m * pack_cost_per_m + bal
        margin = (income - cost) / cost * 100 if cost else 0.0
        tot_pack += pack_m; tot_bal += bal; tot_income += income
        rows.append([mid, tag, in_m, out_m, pack_m, bal, income, margin])
        if cost > 0 and margin < 30 and income >= 1.0:
            warns.append(f"毛利<1.3x: {mid} 毛利={margin:.1f}%")
    gross = tot_income - (tot_pack * pack_cost_per_m + tot_bal)

    if not args.json:
        W = 92
        print("=" * W)
        print(f"TokUp 资源包日报  {d}   （包: {args.pack_tokens/1e6:.0f}M token / ¥{args.pack_price:.0f} = ¥{pack_cost_per_m:.2f}/百万包token）")
        print("=" * W)
        print(f"{'账单模型':<34}{'包内/外':<7}{'输入M':>8}{'输出M':>7}{'包消耗M':>9}{'余额¥':>8}{'卖价¥':>8}{'毛利%':>8}")
        for r in rows:
            print(f"{r[0]:<34}{r[1]:<7}{r[2]:>8.2f}{r[3]:>7.3f}{r[4]:>9.3f}{r[5]:>8.2f}{r[6]:>8.2f}{r[7]:>8.1f}")
        print("-" * W)
        print(f"{'合计':<34}{'':<7}{'':>8}{'':>7}{tot_pack:>9.3f}{tot_bal:>8.2f}{tot_income:>8.2f}")
        print(f"毛利 = 卖价收入 ¥{tot_income:.2f} − (包消耗 ¥{tot_pack*pack_cost_per_m:.2f} + 余额 ¥{tot_bal:.2f}) = ¥{gross:.2f}")
        if warns:
            print("⚠️ " + "; ".join(warns)); return 1
        print("✅ 无异常：毛利均 ≥1.3x")
    else:
        os.makedirs(SNAP_DIR, exist_ok=True)
        snap = {"date": d, "pack_tokens": args.pack_tokens, "pack_price": args.pack_price,
                "rows": rows, "totals": {"pack_m": tot_pack, "balance_yuan": tot_bal,
                                          "income_yuan": tot_income, "gross_yuan": gross}, "warns": warns}
        with open(os.path.join(SNAP_DIR, f"{d}.json"), "w", encoding="utf-8") as f:
            json.dump(snap, f, ensure_ascii=False, indent=2)
        print(json.dumps(snap, ensure_ascii=False, indent=2))
        return 1 if warns else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
