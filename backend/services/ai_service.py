"""
AI API 路由服务 — 根据模型自动选择最优上游
"""
import os
import asyncio
import httpx


def get_api_keys() -> dict:
    """Lazy-load API keys so dotenv is loaded before first call"""
    return {
        "openai": os.getenv("OPENAI_API_KEY", ""),
        "anthropic": os.getenv("ANTHROPIC_API_KEY", ""),
        "deepseek": os.getenv("DEEPSEEK_API_KEY", ""),
        "qiniu": os.getenv("QINIU_API_KEY", ""),
        "zhipu": os.getenv("ZHIPU_API_KEY", ""),
    }


QINIU_ENDPOINT = "https://api.qnaigc.com/v1/chat/completions"
ZHIPU_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

MODEL_ROUTES = {
    # OpenAI (七牛云)
    "gpt-5.5": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "openai/gpt-5.6-luna": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "openai/gpt-5.6-sol": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "openai/gpt-5.6-terra": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "qwen/qwen3.7-max": ("qiniu", QINIU_ENDPOINT),
    # Anthropic (直连)
    # DeepSeek → 七牛云（合规上游）
    "deepseek-v3": ("qiniu", QINIU_ENDPOINT),
    "deepseek-r1": ("qiniu", QINIU_ENDPOINT),
    "deepseek/deepseek-v4-pro": ("qiniu", QINIU_ENDPOINT),
    "deepseek/deepseek-v4-flash": ("qiniu", QINIU_ENDPOINT),
    "deepseek/deepseek-v3.2": ("qiniu", QINIU_ENDPOINT),
    "glm-5.2": ("qiniu", QINIU_ENDPOINT),
    "qwen/qwen3.8-max": ("qiniu", QINIU_ENDPOINT),
    "anthropic/claude-fable-5": ("qiniu", QINIU_ENDPOINT),
    "qwen3-max": ("qiniu", QINIU_ENDPOINT),
    "moonshotai/kimi-k2.6": ("qiniu", QINIU_ENDPOINT),
    "moonshotai/kimi-k3": ("qiniu", QINIU_ENDPOINT),
    "qwen3.5-397b-a17b": ("qiniu", QINIU_ENDPOINT),
    "MiniMax-M1": ("qiniu", QINIU_ENDPOINT),
    "minimax/minimax-m3": ("qiniu", QINIU_ENDPOINT),
    "moonshotai/kimi-k2.7-code": ("qiniu", QINIU_ENDPOINT),
    # 智谱（直连，免费视觉模型）
    "glm-4.6v-flash": ("zhipu", ZHIPU_ENDPOINT),
}

# 2026-08-20 七牛跟随 DeepSeek 官方 8/17 峰谷计价：
#   原厂版 deepseek/deepseek-v4-pro-202606 已于 2026-08-18 退役（模型广场 retirement_at，
#   官方建议迁移 -0813），继续走 -202606 会报错，必须切到 -0813。
#   -0813 按峰谷计费：闲时 ¥4.5/¥13.5、高峰 ¥9/¥27（¥/1M，见 MODEL_COST_PEAK）。
#   内部计费仍按 tokup key deepseek/deepseek-v4-pro，模型名不变。
UPSTREAM_MODEL_NAME = {
    "deepseek/deepseek-v4-pro": "deepseek/deepseek-v4-pro-0813",
}

# 峰谷计费（2026-08-17 DeepSeek 官方 / 七牛同步生效）：
#   高峰时段：每日 9:00-12:00、14:00-18:00（北京时间），闲时 = 高峰价 5 折。
#   仅 DeepSeek V4 系列执行；本平台 v4-flash 走无日期别名 deepseek/deepseek-v4-flash
#   （8/17-8/19 账单实测仍 ¥1/¥2 一口价），不受影响，暂不纳入峰谷。
PEAK_HOUR_RANGES = ((9, 12), (14, 18))  # [start, end) 小时（北京时间）

MODEL_COST = {
    # 2026-08-13 定价修复：按七牛官方账单/模型广场实测成本 × ≥1.3 定价，杜绝倒挂
    "openai/gpt-5.6-luna": (10.0, 55.0),        # 上游实测 ~¥7/¥42（7月账单；8/30 官方降价七牛未必跟进，按高价成本定价）
    "openai/gpt-5.6-sol": (45.0, 270.0),        # 上游实测 ¥34.3/¥207
    "openai/gpt-5.6-terra": (18.0, 110.0),      # 上游实测 ¥13.8/¥83
    "qwen/qwen3.7-max": (16.0, 48.0),           # 上游 ¥12/¥36
    "gpt-5.5": (45.0, 270.0),                   # 上游实测 ¥34.5/¥207
    "claude-3-5-sonnet-20241022": (15.0, 75.0),
    "claude-3-opus-20240229": (60.0, 180.0),
    "claude-3-haiku-20240307": (1.5, 6.0),
    "deepseek-v3": (3.0, 11.0),                 # 上游 ¥2/¥8
    "deepseek-r1": (6.0, 21.0),                 # 上游 ¥4/¥16
    # V4 Pro 走七牛 -0813 峰谷计价：闲时成本 ¥4.5/¥13.5 → 卖 ¥6/¥18（×1.33）；高峰卖价见 MODEL_COST_PEAK
    "deepseek/deepseek-v4-pro": (6.0, 18.0),
    "deepseek/deepseek-v4-flash": (1.5, 3.0),   # 上游无日期别名仍 ¥1/¥2 一口价（8/17-8/19 账单实测），不受 8/17 峰谷公告影响
    "deepseek/deepseek-v3.2": (3.0, 4.0),       # 上游 ¥2/¥3
    "glm-5.2": (11.0, 37.0),                    # 上游 ¥8/¥28
    "qwen/qwen3.8-max": (16.0, 48.0),           # 上游 ¥12/¥36
    "anthropic/claude-fable-5": (90.0, 500.0),   # 2026-08-22 输出+11% 保险（上游计费>API返回约10%，实测毛利仅13%）  # 上游实测 ¥69/¥345
    "qwen3-max": (20.0, 80.0),                  # 上游分档 6/24·10/40·15/60，按最高档 15/60 定价防长上下文倒挂
    "moonshotai/kimi-k2.6": (9.0, 36.0),        # 上游 ¥6.5/¥27
    "moonshotai/kimi-k3": (26.0, 130.0),        # 上游 ¥20/¥100
    "qwen3.5-397b-a17b": (4.0, 24.0),           # 上游最高档 ¥3/¥18 ×1.33，盈利保留
    "MiniMax-M1": (8.0, 32.0),                  # 上游 ¥4/¥16，盈利保留
    "minimax/minimax-m3": (6.0, 24.0),          # 上游 ¥2.1-4.2/¥8.4-16.8，盈利保留
    "moonshotai/kimi-k2.7-code": (9.0, 36.0),   # 上游 ¥6.5/¥27
    "glm-4.6v-flash": (0.0, 0.0),               # 智谱免费
}


# 峰谷模型的「高峰」卖价（¥/1M）：高峰成本 ×1.33（宁贵不可亏，杜绝高峰倒挂）
MODEL_COST_PEAK = {
    "deepseek/deepseek-v4-pro": (12.0, 36.0),   # 上游高峰 ¥9/¥27
}


def _is_beijing_peak_hour() -> bool:
    """当前是否处于高峰时段：每日 9:00-12:00、14:00-18:00（北京时间）"""
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone(timedelta(hours=8)))
    hour = now.hour
    return any(start <= hour < end for start, end in PEAK_HOUR_RANGES)


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    costs = MODEL_COST.get(model)
    if not costs:
        return 0.01
    if model in MODEL_COST_PEAK and _is_beijing_peak_hour():
        costs = MODEL_COST_PEAK[model]
    input_cost = costs[0] * input_tokens / 1_000_000
    output_cost = costs[1] * output_tokens / 1_000_000
    return round(input_cost + output_cost, 6)


def get_headers(provider: str) -> dict:
    keys = get_api_keys()
    key = keys.get(provider, "")
    if provider in ("openai", "qiniu", "zhipu"):
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    elif provider == "anthropic":
        return {"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
    elif provider == "deepseek":
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    return {}


# ── DeepSeek 官方兜底（备胎）：七牛失败时自动切换，需配置 DEEPSEEK_API_KEY ──
DEEPSEEK_OFFICIAL_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL_MAP = {
    "deepseek-v3": "deepseek-chat",
    "deepseek/deepseek-v3.2": "deepseek-chat",
    "deepseek-r1": "deepseek-reasoner",
    # 2026-08-13 V4 Pro 正式转正：官方 API 已有 deepseek-v4-pro 独立模型；
    # deepseek-chat 现在解析为 v4-flash，Pro 兜底必须走 deepseek-v4-pro，否则付费用户拿到 Flash
    "deepseek/deepseek-v4-pro": "deepseek-v4-pro",
    "deepseek/deepseek-v4-flash": "deepseek-chat",
    "deepseek/deepseek-v4-flash-20260731": "deepseek-chat",
}


def _deepseek_fallback(model: str, provider: str):
    """deepseek 模型在七牛失败时切到官方（返回 (官方模型名, provider, url) 或 None）"""
    if provider == "qiniu" and model.startswith("deepseek") and os.getenv("DEEPSEEK_API_KEY"):
        official = DEEPSEEK_MODEL_MAP.get(model)
        if official:
            return official, "deepseek", DEEPSEEK_OFFICIAL_URL
    return None



# ── 上游 HTTP 连接复用（P1 延迟优化）─────────────────────────────
# 全局共享 AsyncClient：复用 TCP/TLS 连接池，避免每个请求都重建连接。
# lazy 初始化 + asyncio.Lock 防止多协程并发重复创建；进程退出时由 main.py shutdown 钩子关闭。
_HTTP_CLIENT = None
_HTTP_CLIENT_LOCK = None


async def _get_http_client():
    global _HTTP_CLIENT, _HTTP_CLIENT_LOCK
    if _HTTP_CLIENT is None or _HTTP_CLIENT.is_closed:
        if _HTTP_CLIENT_LOCK is None:
            _HTTP_CLIENT_LOCK = asyncio.Lock()
        async with _HTTP_CLIENT_LOCK:
            if _HTTP_CLIENT is None or _HTTP_CLIENT.is_closed:
                _HTTP_CLIENT = httpx.AsyncClient(
                    timeout=httpx.Timeout(600.0, connect=30.0),
                    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
                )
    return _HTTP_CLIENT


async def close_http_client():
    """释放上游连接池（app 退出时调用）。失败仅记录，不阻断退出。"""
    global _HTTP_CLIENT
    client = _HTTP_CLIENT
    _HTTP_CLIENT = None
    if client is not None and not client.is_closed:
        try:
            await client.aclose()
        except Exception:
            import logging
            logging.getLogger(__name__).warning("关闭上游连接池失败（忽略）", exc_info=True)


async def proxy_request(model: str, messages: list, stream: bool = False, max_tokens: int | None = None) -> dict:
    """
    转发请求到上游；deepseek 模型在七牛失败时自动切到 DeepSeek 官方兜底。
    每个上游遇到 SSL/网络/HTTP>=400 错误自动重试。
    """
    import logging
    _log = logging.getLogger(__name__)
    route = MODEL_ROUTES.get(model)
    if not route:
        return {"error": f"不支持的模型：{model}"}

    provider, url = route
    candidates = [(UPSTREAM_MODEL_NAME.get(model, model), provider, url)]
    fb = _deepseek_fallback(model, provider)
    if fb:
        candidates.append(fb)

    last_err = ""
    for m_name, prov, u in candidates:
        headers = get_headers(prov)
        if not headers.get("Authorization") and not headers.get("x-api-key"):
            last_err = f"API key not configured for {prov}"
            continue

        payload = {"model": m_name, "messages": messages, "stream": False}
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if prov == "anthropic":
            payload = {"model": m_name, "messages": messages, "max_tokens": max_tokens or 4096}

        for attempt in range(3):
            try:
                client = await _get_http_client()
                resp = await client.post(u, headers=headers, json=payload, timeout=httpx.Timeout(300.0, connect=30.0))
                if resp.status_code >= 400:
                    err_text = resp.text[:200]
                    await resp.aclose()
                    raise RuntimeError(f"HTTP {resp.status_code}: {err_text}")
                result = resp.json()
                await resp.aclose()
                usage = result.get("usage", {})
                input_tokens = usage.get("input_tokens", usage.get("prompt_tokens", 0))
                output_tokens = usage.get("output_tokens", usage.get("completion_tokens", 0))
                cost = calculate_cost(model, input_tokens, output_tokens)
                return {
                    "success": True,
                    "data": result,
                    "usage": {"input": input_tokens, "output": output_tokens, "cost": cost},
                }
            except Exception as e:
                last_err = str(e)
                if attempt < 2:
                    _log.warning(f"上游请求失败（{prov} 第{attempt+1}次），即将重试: model={model} err={e}")
                    continue
                _log.error(f"上游最终失败: model={model} provider={prov} err={e}")
    return {"error": last_err or "所有上游均失败"}




async def proxy_stream_request(model: str, messages: list, max_tokens: int | None = None,
                        tools: list | None = None, tool_choice=None):
    """
    真流式转发：用 stream=True 请求上游，按字节读取 SSE 并实时原样转发。
    - 上游的 reasoning_content（思考过程）也立即转发，客户端不会长时间静默（避免被
      CC Switch / nginx / Cloudflare 的 idle timeout 断流）
    - 遇到 usage chunk 时补充 __USAGE__ 标记（含 reasoning）
    - 整段流既无 reasoning 也无 content 时视为空流，触发一次重试
    """
    import json as _json
    import logging

    route = MODEL_ROUTES.get(model)
    if not route:
        raise ValueError(f"Unsupported model: {model}")

    provider, url = route
    candidates = [(UPSTREAM_MODEL_NAME.get(model, model), provider, url)]
    fb = _deepseek_fallback(model, provider)
    if fb:
        candidates.append(fb)

    last_err = None
    for m_name, prov, u in candidates:
        headers = get_headers(prov)
        if not headers.get("Authorization") and not headers.get("x-api-key"):
            last_err = RuntimeError(f"API key not configured for {prov}")
            continue

        payload = {"model": m_name, "messages": messages, "stream": True}
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if tools:
            payload["tools"] = tools
        if tool_choice:
            payload["tool_choice"] = tool_choice
        if prov == "anthropic":
            payload = {"model": m_name, "messages": messages, "max_tokens": max_tokens or 4096, "stream": True}

        for attempt in range(2):
            try:
                client = await _get_http_client()
                async with client.stream("POST", u, headers=headers, json=payload, timeout=httpx.Timeout(600.0, connect=30.0)) as resp:
                    input_tok = 0
                    output_tok = 0
                    usage_seen = False   # 已捕获到 usage（防止 usage 与 finish_reason 分帧导致漏记）
                    usage_emitted = False
                    full_content = ""
                    full_reasoning = ""
                    started = False      # 出现 reasoning 或 content 即开始转发
                    pending = b""        # 首个内容出现前的缓冲：上游偶发空流时可在转发前重试
                    async for chunk in resp.aiter_bytes():
                        usage_tag = b""
                        try:
                            text = chunk.decode("utf-8")
                            for line in text.split("\n"):
                                if line.startswith("data: ") and "[DONE]" not in line:
                                    data_str = line[6:]
                                    data = _json.loads(data_str)
                                    # OpenAI 风格顶层 usage；Anthropic 风格在 message.usage（message_start/message_delta）
                                    usage = data.get("usage") or (data.get("message") or {}).get("usage") or {}
                                    if usage:
                                        _u_in = usage.get("prompt_tokens", usage.get("input_tokens", 0))
                                        _u_out = usage.get("completion_tokens", usage.get("output_tokens", 0))
                                        if _u_in or _u_out:
                                            input_tok, output_tok = _u_in, _u_out
                                            usage_seen = True
                                    delta = data.get("choices", [{}])[0].get("delta", {}) or {}
                                    rc = delta.get("reasoning_content") or delta.get("reasoning") or ""
                                    dc = delta.get("content") or ""
                                    has_tc = bool(delta.get("tool_calls"))
                                    if rc:
                                        full_reasoning += rc
                                    if dc:
                                        full_content += dc
                                    # 工具调用也是有效输出：立即开始转发，避免被当成空流
                                    if (rc or dc or has_tc) and not started:
                                        started = True
                                    if data.get("choices", [{}])[0].get("finish_reason"):
                                        cost_val = calculate_cost(model, input_tok, output_tok)
                                        usage_tag = f"__USAGE__:{_json.dumps({'input': input_tok, 'output': output_tok, 'cost': cost_val, 'content': full_content, 'reasoning': full_reasoning})}\n".encode()
                                        usage_emitted = True
                        except Exception:
                            pass
                        if started:
                            if usage_tag:
                                yield usage_tag
                            yield chunk
                        else:
                            pending += chunk
                    if not started:
                        # 整段流既无 reasoning 也无 content -> 视为空流，触发重试（客户端尚未收到任何字节）
                        raise RuntimeError("上游流式返回为空（无内容）")
                    if pending:
                        yield pending
                    # 兜底：usage 与 finish_reason 分帧时，流结束后补发 usage，避免回退到字符估算导致少计费
                    if usage_seen and not usage_emitted:
                        cost_val = calculate_cost(model, input_tok, output_tok)
                        yield f"__USAGE__:{_json.dumps({'input': input_tok, 'output': output_tok, 'cost': cost_val, 'content': full_content, 'reasoning': full_reasoning})}\n".encode()
                    return
            except Exception as e:
                last_err = e
                logging.getLogger(__name__).warning(
                    f"上游流式请求失败（{prov} 第{attempt+1}次），即将重试: model={model} err={e}"
                )
                continue
    raise RuntimeError(f"流式请求失败（所有上游均失败）: {last_err}")
