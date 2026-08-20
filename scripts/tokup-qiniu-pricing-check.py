#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TokUp 七牛账单倒挂核查脚本（每周自动化使用，只读）
- 拉取七牛官方账单 API（/v3/stat/usage/apikey/cost，week+month）拿到每个模型实际扣费 → 反推有效单价
- 拉取七牛模型广场 __NEXT_DATA__ 价格表（在售模型刊例价，取最高档防长上下文倒挂）
- 对比本地 MODEL_COST：卖价 < 上游成本 = 倒挂（CRITICAL）；毛利 < 1.3x = 低毛利（WARNING）
- 自动识别 UPSTREAM_MODEL_NAME（deepseek-v4-pro → 原厂版 -202606）：成本一律按「当前上游」算，避免把切换前历史账单误报
- 保存快照 scripts/model_snapshots/pricing/YYYYMMDD.json 供历史对比

用法:
  python3 scripts/tokup-qiniu-pricing-check.py            # 人类可读报告
  python3 scripts/tokup-qiniu-pricing-check.py --json     # 机器可读 JSON
  python3 scripts/tokup-qiniu-pricing-check.py --min-margin 1.3   # 自定义最低毛利阈值
退出码: 0=无倒挂; 1=存在倒挂或严重低毛利
"""
import argparse
import ast
import datetime as dt
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_SERVICE = os.path.join(ROOT, "backend", "services", "ai_service.py")
ENV_FILE = os.path.join(ROOT, "backend", ".env")
SNAP_DIR = os.path.join(ROOT, "scripts", "model_snapshots", "pricing")

QINIU_COST_URL = "https://api.qnaigc.com/v3/stat/usage/apikey/cost"
QINIU_MODELS_PAGE = "https://www.qiniu.com/ai/models"
MIN_RELIABLE_TOKENS = 20_000  # 账单费用保留2位小数，样本低于此值反推单价不可靠

# 七牛账单 model_id → tokup key 的显式别名（upstream 映射之外的写法差异）
BILLING_ALIASES = {
    "deepseek/deepseek-v3.2-exp": "deepseek/deepseek-v3.2",
    "deepseek/deepseek-v3.2-exp-thinking": "deepseek/deepseek-v3.2",
    "deepseek/deepseek-v3.2-251201": "deepseek/deepseek-v3.2",
    "deepseek/deepseek-v4-flash-202605": "deepseek/deepseek-v4-flash",
    "deepseek/deepseek-v4-flash-20260731": "deepseek/deepseek-v4-flash",
    "deepseek/deepseek-v4-pro-0813": "deepseek/deepseek-v4-pro",
    "deepseek/deepseek-v4-pro-202606": "deepseek/deepseek-v4-pro",
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


def load_local():
    src = open(AI_SERVICE, encoding="utf-8").read()
    costs = parse_py_dict(src, "MODEL_COST")
    routes = parse_py_dict(src, "MODEL_ROUTES")
    upstream = parse_py_dict(src, "UPSTREAM_MODEL_NAME")
    return costs, routes, upstream


def http_get_json(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


QINIU_COST_DETAIL_URL = "https://api.qnaigc.com/v3/stat/usage/apikey/cost-detail"
BILLING_WINDOW_DAYS = 90   # cost-detail 最大支持 100 天（含端点边界留余量）


def fetch_billing(api_key, period=None):
    """返回 {model_id: {'input':(fee,tokens), 'output':(fee,tokens), 'total_fee':x}}
    主用 cost-detail（近 100 天，样本大更可靠）；失败回退 cost 汇总接口（week+month）。"""
    import urllib.parse
    end = dt.date.today()
    start = end - dt.timedelta(days=BILLING_WINDOW_DAYS)
    models = {}
    errors = []
    try:
        url = (QINIU_COST_DETAIL_URL + "?" + urllib.parse.urlencode(
            {"start_date": start.isoformat(), "end_date": end.isoformat(), "grain": "month"}))
        j = http_get_json(url, {"Authorization": f"Bearer {api_key}"})
        for b in j.get("data", {}).get("bills", []):
            for m in b.get("models", []):
                mid = m.get("model_id")
                entry = models.setdefault(mid, {"input": (0.0, 0.0), "output": (0.0, 0.0), "total_fee": 0.0})
                entry["total_fee"] += float(m.get("total_fee") or 0)
                for it in m.get("items", []):
                    _accum(it, entry)
    except Exception as e:
        errors.append(f"cost-detail: {type(e).__name__}: {e}")
        # 回退：cost 汇总（type=month）
        try:
            url = QINIU_COST_URL + "?" + urllib.parse.urlencode({"type": "month"})
            j = http_get_json(url, {"Authorization": f"Bearer {api_key}"})
            for ak in j.get("data", {}).get("api_keys", []):
                for m in ak.get("models", []):
                    mid = m.get("model_id")
                    entry = models.setdefault(mid, {"input": (0.0, 0.0), "output": (0.0, 0.0), "total_fee": 0.0})
                    entry["total_fee"] += float(m.get("total_fee") or 0)
                    for it in m.get("items", []):
                        _accum(it, entry)
        except Exception as e2:
            errors.append(f"cost: {type(e2).__name__}: {e2}")
    return models, errors


def _accum(it, entry):
    key = it.get("key", "")
    usage = it.get("usage", {})
    count = float(usage.get("count") or 0)
    unit = usage.get("unit", "")
    if unit in ("k/tokens", "kToken"):
        toks = count * 1000
    elif unit == "tokens":
        toks = count
    else:
        toks = 0  # 百字符/分钟等非 token 计费项跳过
    fee = float(it.get("fee") or 0)
    if "output" in key:
        f, t = entry["output"]
        entry["output"] = (f + fee, t + toks)
    elif "ncache" in key or "input" in key:
        f, t = entry["input"]
        entry["input"] = (f + fee, t + toks)
    # cache / c_cache（缓存命中/写入）成本极低，不参与倒挂判断


def fetch_plaza_prices():
    """解析模型广场 __NEXT_DATA__，返回 {model_id: {"flat":(i,o)|None,"offpeak":(i,o)|None,"peak":(i,o)|None}}
    - flat: 旧一口价（input/output 或 ncache/output）
    - offpeak/peak: 2026-08-17 DeepSeek V4 系列峰谷价（ncache_offpeak/output_offpeak 等）
    所有价格均取各档最高值，单位 ¥/1M tokens。"""
    html = urllib.request.urlopen(QINIU_MODELS_PAGE, timeout=30).read().decode("utf-8", "ignore")
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    if not m:
        return {}
    data = json.loads(m.group(1))
    models = data.get("props", {}).get("pageProps", {}).get("models", [])
    out = {}
    for md in models:
        pid = md.get("id")
        res = {"flat": None, "offpeak": None, "peak": None}
        for rule in md.get("pricing_rules_v2") or []:
            dv2 = rule.get("details_v2") or {}
            pairs = []
            if isinstance(dv2.get("input"), dict) and isinstance(dv2.get("output"), dict):
                pairs.append(("input", "output", "flat"))
            if isinstance(dv2.get("ncache"), dict) and isinstance(dv2.get("output"), dict):
                pairs.append(("ncache", "output", "flat"))
            # 峰谷（DeepSeek V4 系列）：ncache_{peak,offpeak} / output_{peak,offpeak}
            for suf in ("_peak", "_offpeak"):
                if isinstance(dv2.get("ncache" + suf), dict) and isinstance(dv2.get("output" + suf), dict):
                    pairs.append(("ncache" + suf, "output" + suf, suf[1:]))
            for i_key, o_key, bucket in pairs:
                iu = dv2[i_key].get("unit_price")
                ou = dv2[o_key].get("unit_price")
                if iu is None or ou is None:
                    continue
                scaled = (float(iu) * 1000, float(ou) * 1000)  # 千token → 1M
                cur = res[bucket]
                if cur is None or scaled > cur:
                    res[bucket] = scaled
        if any(v is not None for v in res.values()):
            out[pid] = res
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--min-margin", type=float, default=1.3, help="最低毛利阈值")
    args = ap.parse_args()

    costs, routes, upstream = load_local()
    src_all = open(AI_SERVICE, encoding="utf-8").read()
    peak_costs = parse_py_dict(src_all, "MODEL_COST_PEAK")  # 峰谷模型的高峰卖价
    env = load_env()
    qk = env.get("QINIU_API_KEY", "")

    # 反向映射：上游 model_id → tokup key
    rev_upstream = {v: k for k, v in upstream.items()}

    def to_tokup(mid):
        if mid in BILLING_ALIASES:
            return BILLING_ALIASES[mid]
        if mid in rev_upstream:
            return rev_upstream[mid]
        if mid in costs:
            return mid
        # 七牛账单会把 gpt-5.5 记成 openai/gpt-5.5 等，尝试去常见前缀匹配
        for pre in ("openai/", "anthropic/", "qwen/", "moonshotai/", "z-ai/", "minimax/"):
            if mid.startswith(pre) and mid[len(pre):] in costs:
                return mid[len(pre):]
        return mid

    def plaza_get(up_id, tk):
        """广场 model_id → 价格字典（flat/offpeak/peak）。七牛广场用 z-ai/glm-5.2 等带前缀 ID，而 tokup 可能发短名。"""
        cands = [up_id, tk,
                 "z-ai/" + tk, "deepseek/" + tk, "moonshotai/" + tk,
                 "qwen/" + tk, "openai/" + tk, "anthropic/" + tk]
        # 账单别名反向：如 v3.2 → deepseek/deepseek-v3.2-exp / -251201
        cands += [mid for mid, t in BILLING_ALIASES.items() if t == tk]
        for cand in cands:
            if cand in plaza:
                return plaza[cand]
        return None

    def worst_case(cmap):
        """展示用成本：取最差档（高峰 > 闲时 > 一口价）"""
        return cmap.get("peak") or cmap.get("offpeak") or cmap.get("flat")

    def build_scenarios(tk, cmap):
        """峰谷/多档模型逐档比较场景：[(档位, 卖价, 成本)]；无峰谷返回 None（走旧逻辑）"""
        base = costs.get(tk)
        if not base or not isinstance(base, (tuple, list)) or len(base) != 2:
            return None
        sc = []
        for key, cv in (("flat", cmap.get("flat")), ("offpeak", cmap.get("offpeak")), ("peak", cmap.get("peak"))):
            if cv is None:
                continue
            sv = peak_costs.get(tk) if key == "peak" else base
            if not sv or not isinstance(sv, (tuple, list)) or len(sv) != 2:
                continue
            sc.append((f"{key}输入", sv[0], cv[0]))
            sc.append((f"{key}输出", sv[1], cv[1]))
        return sc or None

    billing_raw = {}
    plaza = {}
    errs = {}
    if qk:
        billing_raw, billing_errs = fetch_billing(qk)
        errs.update({f"billing_{i}": e for i, e in enumerate(billing_errs)})
        try:
            plaza = fetch_plaza_prices()
        except Exception as e:
            errs["plaza"] = f"{type(e).__name__}: {e}"
    else:
        errs["billing_0"] = "QINIU_API_KEY 缺失（backend/.env）"

    # 把账单按 tokup key 合并（同一 tokup 模型可能对应多个七牛 model_id，如 v4-pro 标准版+原厂版）
    merged = {}
    for mid, e in billing_raw.items():
        tk = to_tokup(mid)
        if tk not in costs:
            continue
        me = merged.setdefault(tk, {"input": (0.0, 0.0), "output": (0.0, 0.0), "total_fee": 0.0,
                                    "billed_as": set()})
        me["input"] = tuple(a + b for a, b in zip(me["input"], e["input"]))
        me["output"] = tuple(a + b for a, b in zip(me["output"], e["output"]))
        me["total_fee"] += e["total_fee"]
        me["billed_as"].add(mid)

    def eff_cost(me):
        (i_fee, i_tok), (o_fee, o_tok) = me["input"], me["output"]
        ic = (i_fee / i_tok * 1_000_000) if i_tok >= MIN_RELIABLE_TOKENS else None
        oc = (o_fee / o_tok * 1_000_000) if o_tok >= MIN_RELIABLE_TOKENS else None
        return ic, oc

    issues, detail = [], []

    def check(tk, sell, cost, source, billed_as, has_billing, scenarios=None):
        verdict, notes = [], []
        if scenarios:
            # 峰谷/多档模型：逐档比较，任一档倒挂即失败（宁贵不可亏）
            for lbl, sv, cv in scenarios:
                if cv is None or cv <= 0:
                    continue
                ratio = sv / cv
                if sv < cv:
                    verdict.append(f"{lbl}倒挂(卖{sv}<成本{cv})")
                elif ratio < args.min_margin:
                    notes.append(f"{lbl}毛利{ratio:.2f}x<{args.min_margin}")
        elif cost:
            for lbl, sell_v, cost_v in (("输入", sell[0], cost[0]), ("输出", sell[1], cost[1])):
                if cost_v is None or cost_v <= 0:
                    continue
                ratio = sell_v / cost_v
                if sell_v < cost_v:
                    verdict.append(f"{lbl}倒挂(卖{sell_v}<成本{cost_v})")
                elif ratio < args.min_margin:
                    notes.append(f"{lbl}毛利{ratio:.2f}x<{args.min_margin}")
        detail.append({"model": tk, "billed_as": sorted(billed_as)[:3], "sell": list(sell),
                       "cost": list(cost) if cost else None, "source": source,
                       "issue": verdict or notes, "has_billing": has_billing})
        if verdict:
            issues.append({"model": tk, "billed_as": sorted(billed_as)[:3], "cost": list(cost) if cost else None,
                           "sell": list(sell), "verdict": verdict, "source": source})

    # 1) 有账单用量的模型
    for tk, me in sorted(merged.items()):
        sell = costs[tk]
        if not sell or not isinstance(sell, (tuple, list)) or len(sell) != 2:
            continue
        up_id = upstream.get(tk, tk)
        cmap = plaza_get(up_id, tk)  # 当前上游的广场价（含峰谷档）
        ic, oc = eff_cost(me)       # 账单实测有效单价（样本≥20K token）
        # 判定以「当前上游成本」为准；无广场价才用账单实测，避免把切换前用量误报为倒挂
        if cmap:
            cost, source = worst_case(cmap), "广场价(当前上游)"
        elif ic is not None and oc is not None:
            cost, source = (ic, oc), "账单实测"
        else:
            cost, source = None, "无成本数据"
        check(tk, sell, cost, source, me["billed_as"], True,
              scenarios=build_scenarios(tk, cmap) if cmap else None)
        # 补充提示：账单实测成本明显高于当前上游广场价（可能含切换前用量/上游涨价），仅提示不判失败
        if ic is not None and oc is not None and cmap and \
                (ic > cost[0] * 1.05 or oc > cost[1] * 1.05):
            detail[-1]["issue"] = (detail[-1]["issue"] or []) + \
                [f"注:账单实测成本({ic:.2f},{oc:.2f})高于当前上游广场价{cost}（可能含切换前用量或上游调价，下期观察）"]

    # 1.5) 智谱免费模型显式标注
    for tk, sell in costs.items():
        if tk in merged or tk in {d["model"] for d in detail}:
            continue
        if sell and isinstance(sell, (tuple, list)) and len(sell) == 2 and sell[0] == 0 and sell[1] == 0:
            detail.append({"model": tk, "billed_as": [], "sell": list(sell), "cost": [0.0, 0.0],
                           "source": "免费(智谱直连)", "issue": [], "has_billing": False})

    # 2) 无账单用量的在售模型：用当前上游广场价兜底
    for tk in sorted(costs):
        if tk in merged or tk not in routes:
            continue
        sell = costs[tk]
        if not sell or not isinstance(sell, (tuple, list)) or len(sell) != 2:
            continue
        up_id = upstream.get(tk, tk)
        pc = plaza_get(up_id, tk)
        if not pc:
            continue
        check(tk, sell, worst_case(pc), "广场价", {up_id}, False,
              scenarios=build_scenarios(tk, pc))

    today = dt.date.today().isoformat()
    os.makedirs(SNAP_DIR, exist_ok=True)
    snap = {
        "date": today, "fetched_at": dt.datetime.now().astimezone().isoformat(),
        "min_margin": args.min_margin, "errors": errs,
        "issues": issues, "detail": detail,
    }
    with open(os.path.join(SNAP_DIR, f"{today}.json"), "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, indent=2)

    if args.json:
        print(json.dumps(snap, ensure_ascii=False, indent=2))
        return 1 if issues else 0

    print("=" * 62)
    print(f"TokUp 七牛账单倒挂核查  {today}  (近{BILLING_WINDOW_DAYS}天账单, 最低毛利≥{args.min_margin}x)")
    print("=" * 62)
    for k, v in errs.items():
        print(f"⚠️ {k}: {v}")

    if issues:
        print("\n❌ 倒挂/低毛利模型：")
        for it in issues:
            print(f"  - {it['model']} (bill_as={it['billed_as']}, 来源={it['source']})")
            print(f"      卖价 {it['sell']} vs 成本 {it['cost']}")
            for v in it["verdict"]:
                print(f"      ▶ {v}")
    else:
        print("\n✅ 全部在售模型无倒挂")

    print("\n▍明细（有账单用量优先账单实测；样本<20K token 用当前上游广场价）")
    for d in detail:
        flag = "❌" if any("倒挂" in str(x) for x in d["issue"]) else ("⚠️" if d["issue"] else "  ")
        print(f"  {flag} {d['model']:<34} 卖{d['sell']}  成本{d['cost']}  [{d['source']}]")
        for x in d["issue"]:
            if "注:" in str(x):
                print(f"        {x}")
    print(f"\n快照: {SNAP_DIR}/{today}.json")
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
