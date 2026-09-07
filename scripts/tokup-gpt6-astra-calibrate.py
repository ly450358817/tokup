#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GPT-6 Astra 首账单自动校准（每日巡检用，只读 + 输出校准建议，不直接改生产）
============================================================
- 拉七牛账单(cost-detail, 近90天)，找 openai/gpt-6-astra 的实际扣费
- 反推真实 ¥/1M 输入/输出成本
- 对比本地 MODEL_COST（当前 ¥115/¥675，系按 Sol×2.5 估算）
- 若已有可靠账单且 1.3x 成本 > 当前卖价 → 输出 action=calibrate + 建议新价（宁高勿亏，向上取整）
- 否则 action=noop

用法:
  python3 scripts/tokup-gpt6-astra-calibrate.py          # 人类可读
  python3 scripts/tokup-gpt6-astra-calibrate.py --json   # 机器可读（每日自动化用）
退出码: 0=无需校准; 1=需要校准（或出错）
"""
import argparse, ast, datetime as dt, json, os, re, sys, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_SERVICE = os.path.join(ROOT, "backend", "services", "ai_service.py")
ENV_FILE = os.path.join(ROOT, "backend", ".env")
SNAP_DIR = os.path.join(ROOT, "scripts", "model_snapshots", "astra")
MODEL = "openai/gpt-6-astra"
COST_DETAIL_URL = "https://api.qnaigc.com/v3/stat/usage/apikey/cost-detail"
DAYS = 90
MIN_TOKENS = 20_000      # 单边 token 达到此值才认为账单样本可靠
MIN_MARGIN = 1.3


def load_env():
    env = {}
    if os.path.exists(ENV_FILE):
        for line in open(ENV_FILE, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def parse_cost(src, name):
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


def http_get_json(url, headers, timeout=30):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_billing(api_key):
    """返回 (input_fee, input_tokens, output_fee, output_tokens, total_fee) for MODEL"""
    end = dt.date.today()
    start = end - dt.timedelta(days=DAYS)
    url = COST_DETAIL_URL + "?" + urllib.parse.urlencode(
        {"start_date": start.isoformat(), "end_date": end.isoformat(), "grain": "month"})
    j = http_get_json(url, {"Authorization": f"Bearer {api_key}"})
    i_fee = i_tok = o_fee = o_tok = tot = 0.0
    for b in (j.get("data", {}).get("bills") or []):
        for m in (b.get("models") or []):
            if m.get("model_id") != MODEL:
                continue
            tot += float(m.get("total_fee") or 0)
            for it in (m.get("items") or []):
                u = it.get("usage") or {}
                cnt = float(u.get("count") or 0)
                unit = u.get("unit", "")
                toks = cnt * 1000 if unit in ("k/tokens", "kToken") else (cnt if unit == "tokens" else 0)
                fee = float(it.get("fee") or 0)
                key = it.get("key", "")
                if "output" in key:
                    o_fee += fee; o_tok += toks
                elif "ncache" in key or "input" in key:
                    i_fee += fee; i_tok += toks
    return i_fee, i_tok, o_fee, o_tok, tot


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    env = load_env()
    qk = env.get("QINIU_API_KEY", "")
    costs = parse_cost(open(AI_SERVICE, encoding="utf-8").read(), "MODEL_COST")
    cur = costs.get(MODEL)
    if not cur or not isinstance(cur, (list, tuple)) or len(cur) != 2:
        cur = [115.0, 675.0]
    cur = [float(cur[0]), float(cur[1])]

    out = {"date": dt.date.today().isoformat(), "model": MODEL, "current": cur,
           "action": "noop", "bill": None, "cost": None, "new_price": None, "reason": ""}
    if not qk:
        out["reason"] = "QINIU_API_KEY 缺失"
        if args.json:
            print(json.dumps(out, ensure_ascii=False))
        else:
            print("❌ QINIU_API_KEY 缺失（backend/.env）")
        return 1

    try:
        i_fee, i_tok, o_fee, o_tok, tot = fetch_billing(qk)
    except Exception as e:
        out["reason"] = f"账单拉取失败: {type(e).__name__}: {e}"
        if args.json:
            print(json.dumps(out, ensure_ascii=False))
        else:
            print(f"❌ 账单拉取失败: {e}")
        return 1

    out["bill"] = {"input_fee": round(i_fee, 4), "input_tokens": int(i_tok),
                   "output_fee": round(o_fee, 4), "output_tokens": int(o_tok),
                   "total_fee": round(tot, 4)}

    if i_tok < MIN_TOKENS or o_tok < MIN_TOKENS or tot <= 0:
        out["reason"] = f"尚无可靠账单（输入{i_tok:.0f}/输出{o_tok:.0f} token，需各≥{MIN_TOKENS}）"
        if args.json:
            print(json.dumps(out, ensure_ascii=False))
        else:
            print(f"⏳ 尚无第一笔可靠账单：输入{i_tok:.0f} / 输出{o_tok:.0f} token（阈值各{MIN_TOKENS}），暂不校准，按估算价 ¥{cur[0]}/¥{cur[1]} 继续。")
        return 0

    ic = i_fee / i_tok * 1_000_000
    oc = o_fee / o_tok * 1_000_000
    out["cost"] = [round(ic, 2), round(oc, 2)]

    # 向上取整到整数元，宁高勿亏
    ni = int(ic * MIN_MARGIN) + (1 if (ic * MIN_MARGIN) % 1 > 0 else 0)
    no = int(oc * MIN_MARGIN) + (1 if (oc * MIN_MARGIN) % 1 > 0 else 0)
    out["new_price"] = [ni, no]

    if ni > cur[0] or no > cur[1]:
        out["action"] = "calibrate"
        out["reason"] = f"账单实测成本 ¥{ic:.2f}/¥{oc:.2f}，1.3x 需 ¥{ni}/¥{no}，高于当前卖价 ¥{cur[0]}/¥{cur[1]}"
    else:
        out["reason"] = f"账单实测成本 ¥{ic:.2f}/¥{oc:.2f}，1.3x 为 ¥{ni}/¥{no}，当前卖价已足够，无需上调"

    os.makedirs(SNAP_DIR, exist_ok=True)
    with open(os.path.join(SNAP_DIR, f"{dt.date.today().isoformat()}.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    if args.json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
    else:
        flag = "🔴 需要校准" if out["action"] == "calibrate" else "✅ 无需校准"
        print(f"{flag} {out['reason']}")
    return 1 if out["action"] == "calibrate" else 0


if __name__ == "__main__":
    sys.exit(main())
