#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TokUp 上游模型审计脚本（每周自动化使用，只读 + 对候选退役模型做一次最小调用实测）
- 拉取七牛(qnaigc) /v1/models 与 DeepSeek 官方 /models
- 解析本地 backend/services/ai_service.py 的 MODEL_ROUTES / MODEL_COST
- 输出：新增模型 / 疑似退役模型（实测确认）/ 建议定价
- 保存快照到 scripts/model_snapshots/YYYYMMDD.json 供历史对比

用法:
  python3 scripts/tokup-models-audit.py          # 人类可读报告
  python3 scripts/tokup-models-audit.py --json   # 机器可读 JSON
  python3 scripts/tokup-models-audit.py --no-verify  # 跳过退役实测（只对比列表）
"""
import argparse
import ast
import datetime as dt
import json
import os
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_SERVICE = os.path.join(ROOT, "backend", "services", "ai_service.py")
ENV_FILE = os.path.join(ROOT, "backend", ".env")
SNAP_DIR = os.path.join(ROOT, "scripts", "model_snapshots")

QINIU_MODELS_URL = "https://api.qnaigc.com/v1/models"
QINIU_CHAT_URL = "https://api.qnaigc.com/v1/chat/completions"
DEEPSEEK_MODELS_URL = "https://api.deepseek.com/models"


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


def load_local_models():
    src = open(AI_SERVICE, encoding="utf-8").read()
    routes = parse_py_dict(src, "MODEL_ROUTES")
    costs = parse_py_dict(src, "MODEL_COST")
    fallback = parse_py_dict(src, "DEEPSEEK_MODEL_MAP")
    return routes, costs, fallback


def http_get_json(url, headers, timeout=25):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_upstream(env):
    out = {"qiniu": [], "deepseek": []}
    errs = {}
    qk = env.get("QINIU_API_KEY", "")
    if qk:
        try:
            j = http_get_json(QINIU_MODELS_URL, {"Authorization": f"Bearer {qk}"})
            out["qiniu"] = [m["id"] for m in j.get("data", [])]
        except Exception as e:
            errs["qiniu"] = f"{type(e).__name__}: {e}"
    else:
        errs["qiniu"] = "QINIU_API_KEY 缺失（backend/.env）"
    dk = env.get("DEEPSEEK_API_KEY", "")
    if dk:
        try:
            j = http_get_json(DEEPSEEK_MODELS_URL, {"Authorization": f"Bearer {dk}"})
            out["deepseek"] = [m["id"] for m in j.get("data", [])]
        except Exception as e:
            errs["deepseek"] = f"{type(e).__name__}: {e}"
    else:
        errs["deepseek"] = "DEEPSEEK_API_KEY 缺失（本地 .env 无，仅七牛对比）"
    return out, errs


def probe_model(model, key, timeout=40):
    """最小调用实测：返回 ("ok"|"gone"|"unknown", 说明)。max_output_tokens=16 避免参数误判。"""
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 16,
    }).encode()
    req = urllib.request.Request(
        QINIU_CHAT_URL, data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return "ok", f"HTTP {r.status}"
    except urllib.error.HTTPError as e:
        msg = ""
        try:
            msg = json.loads(e.read().decode() or "{}").get("error", {}).get("message", "") or ""
        except Exception:
            pass
        low = msg.lower()
        if e.code == 404 or "model not found" in low or "does not exist" in low or "not found" in low:
            return "gone", f"HTTP {e.code}: {msg[:120]}"
        if "no available channels" in low:
            return "gone", f"HTTP {e.code}: {msg[:120]}（上游通道缺失，可能退役或临时）"
        # 其他 400 如 max_output_tokens 下限 → 说明模型存在可用
        return "ok", f"HTTP {e.code}: {msg[:120]}"
    except Exception as e:
        return "unknown", f"{type(e).__name__}: {str(e)[:120]}"


MAINSTREAM = ["deepseek", "gpt-", "o1", "o3", "o4", "qwen", "glm", "kimi", "moonshot",
              "doubao", "claude", "gemini", "minimax", "kling", "flux", "sora", "grok", "llama", "mistral"]


def suggest_price(model, costs):
    """按系列推断建议售价 (input, output) 元/1M；无法推断返回 None"""
    lower = model.lower()
    series = None
    for tag in ["deepseek", "gpt", "qwen", "glm", "kimi", "moonshot", "doubao", "claude", "gemini", "minimax"]:
        if tag in lower:
            series = tag
            break
    if not series:
        return None
    cand = []
    for m, c in costs.items():
        if series in m.lower() and isinstance(c, (list, tuple)) and len(c) == 2:
            cand.append((float(c[0]), float(c[1])))
    if not cand:
        return None
    n = len(cand)
    inp = round(sum(c[0] for c in cand) / n, 2)
    out = round(sum(c[1] for c in cand) / n, 2)
    return (inp, out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--no-verify", action="store_true", help="跳过退役实测")
    args = ap.parse_args()

    env = load_env()
    routes, costs, fallback = load_local_models()
    upstream, errs = fetch_upstream(env)

    tokup_set = set(routes.keys())
    qiniu_set = set(upstream["qiniu"])
    ds_set = set(upstream["deepseek"])
    upstream_all = qiniu_set | ds_set

    new_ids = sorted(upstream_all - tokup_set)
    # 疑似退役：tokup 有、上游列表无；排除 DeepSeek 官方兜底模型（官方仍提供）
    suspect_gone = sorted(m for m in (tokup_set - upstream_all) if m not in fallback)

    # 实测确认退役
    verified_gone = []
    still_works = []
    qk = env.get("QINIU_API_KEY", "")
    if args.no_verify or not qk:
        verified_gone, still_works = suspect_gone, []
        if not qk:
            errs.setdefault("verify", "无 QINIU_API_KEY，退役候选未实测")
    else:
        for m in suspect_gone:
            status, note = probe_model(m, qk)
            if status == "gone":
                verified_gone.append((m, note))
            elif status == "ok":
                still_works.append((m, note))
            else:
                still_works.append((m, f"未确认({note})"))

    today = dt.date.today().isoformat()
    os.makedirs(SNAP_DIR, exist_ok=True)
    snap = {
        "date": today,
        "fetched_at": dt.datetime.now().astimezone().isoformat(),
        "upstream_qiniu_count": len(qiniu_set),
        "upstream_deepseek_count": len(ds_set),
        "tokup_model_count": len(tokup_set),
        "new": new_ids,
        "verified_gone": [m for m, _ in verified_gone],
        "still_works": [m for m, _ in still_works],
        "errors": errs,
    }
    with open(os.path.join(SNAP_DIR, f"{today}.json"), "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, indent=2)

    prev_new = set()
    prev_files = sorted(f for f in os.listdir(SNAP_DIR) if f.endswith(".json") and f != f"{today}.json")
    if prev_files:
        try:
            prev = json.load(open(os.path.join(SNAP_DIR, prev_files[-1]), encoding="utf-8"))
            prev_new = set(prev.get("new", []))
        except Exception:
            pass

    if args.json:
        print(json.dumps(snap, ensure_ascii=False, indent=2))
        return

    print("=" * 64)
    print(f"TokUp 上游模型审计  {today}")
    print("=" * 64)
    print(f"七牛(qnaigc)列表: {len(qiniu_set)} | DeepSeek官方: {len(ds_set)} | TokUp已接入: {len(tokup_set)}")
    for k, v in errs.items():
        print(f"  ⚠ {k}: {v}")

    print(f"\n📦 新增候选（上游有、TokUp 未接入）: {len(new_ids)}")
    for m in new_ids:
        price = suggest_price(m, costs)
        tag = "主流" if any(t in m.lower() for t in MAINSTREAM) else "边缘"
        if price:
            print(f"  [+{tag}] {m}  → 建议(¥/1M) 入{price[0]} 出{price[1]}")
        else:
            print(f"  [+{tag}] {m}  → ⚠ 无同系列参照 NEED_REVIEW")

    if prev_new:
        newly_since_last = sorted(set(new_ids) - prev_new)
        print(f"\n  🆕 较上次快照({prev_files[-1] if prev_files else '无'})的新增: {len(newly_since_last)}")
        for m in newly_since_last:
            print(f"    - {m}")

    print(f"\n🗑 疑似退役（列表无 + 已实测）: {len(verified_gone)}")
    for m, note in verified_gone:
        print(f"  [-]{m}  ({note})")
    print(f"\n🔁 列表未显示但实测仍可用: {len(still_works)}")
    for m, note in still_works:
        print(f"  [~]{m}  ({note})")

    print(f"\n💾 快照: {SNAP_DIR}/{today}.json")
    print("⚠ 七牛 /models 不返回价格，建议价仅为同系列均值估算；接入前请核对真实成本（利润率≥1.3x），避免亏本。")


if __name__ == "__main__":
    main()
