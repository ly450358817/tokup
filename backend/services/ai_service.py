"""
AI API 路由服务 — 根据模型自动选择最优上游
"""
import os
import httpx


def get_api_keys() -> dict:
    """Lazy-load API keys so dotenv is loaded before first call"""
    return {
        "openai": os.getenv("OPENAI_API_KEY", ""),
        "anthropic": os.getenv("ANTHROPIC_API_KEY", ""),
        "deepseek": os.getenv("DEEPSEEK_API_KEY", ""),
        "qiniu": os.getenv("QINIU_API_KEY", ""),
    }


QINIU_ENDPOINT = "https://api.qnaigc.com/v1/chat/completions"

MODEL_ROUTES = {
    # OpenAI (七牛云)
    "gpt-4o": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "gpt-4o-mini": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "gpt-4-turbo": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "gpt-5.5": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "openai/gpt-5.6-luna": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "openai/gpt-5.6-sol": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "openai/gpt-5.6-terra": ("qiniu", "https://api.qnaigc.com/v1/chat/completions"),
    "qwen/qwen3.7-max": ("qiniu", QINIU_ENDPOINT),
    # Anthropic (直连)
    "claude-3-5-sonnet-20241022": ("anthropic", "https://api.anthropic.com/v1/messages"),
    "claude-3-opus-20240229": ("anthropic", "https://api.anthropic.com/v1/messages"),
    "claude-3-haiku-20240307": ("anthropic", "https://api.anthropic.com/v1/messages"),
    # DeepSeek → 七牛云（合规上游）
    "deepseek-v3": ("qiniu", QINIU_ENDPOINT),
    "deepseek-r1": ("qiniu", QINIU_ENDPOINT),
    "deepseek/deepseek-v4-pro": ("qiniu", QINIU_ENDPOINT),
    "deepseek/deepseek-v4-flash": ("qiniu", QINIU_ENDPOINT),
    "deepseek/deepseek-v4-flash-20260731": ("qiniu", QINIU_ENDPOINT),
    "deepseek/deepseek-v3.2": ("qiniu", QINIU_ENDPOINT),
    "glm-5.2": ("qiniu", QINIU_ENDPOINT),
    "qwen/qwen3.8-max": ("qiniu", QINIU_ENDPOINT),
    "anthropic/claude-fable-5": ("qiniu", QINIU_ENDPOINT),
    "glm-4.5": ("qiniu", QINIU_ENDPOINT),
    "doubao-seed-1.6": ("qiniu", QINIU_ENDPOINT),
    "qwen3-max": ("qiniu", QINIU_ENDPOINT),
    "moonshotai/kimi-k2.6": ("qiniu", QINIU_ENDPOINT),
    "moonshotai/kimi-k3": ("qiniu", QINIU_ENDPOINT),
    "qwen3-coder-480b-a35b-instruct": ("qiniu", QINIU_ENDPOINT),
}

MODEL_COST = {
    "gpt-4o": (20.0, 60.0),
    "gpt-4o-mini": (1.5, 4.5),
    "openai/gpt-5.6-luna": (35.0, 100.0),
    "openai/gpt-5.6-sol": (20.0, 80.0),
    "openai/gpt-5.6-terra": (20.0, 80.0),
    "qwen/qwen3.7-max": (5.0, 15.0),
    "gpt-4-turbo": (30.0, 60.0),
    "gpt-5.5": (30.0, 60.0),
    "claude-3-5-sonnet-20241022": (15.0, 75.0),
    "claude-3-opus-20240229": (60.0, 180.0),
    "claude-3-haiku-20240307": (1.5, 6.0),
    "deepseek-v3": (0.5, 1.0),
    "deepseek-r1": (1.0, 2.0),
    "deepseek/deepseek-v4-pro": (0.8, 1.6),
    "deepseek/deepseek-v4-flash": (0.3, 0.6),
    "deepseek/deepseek-v4-flash-20260731": (0.5, 2.5),
    "deepseek/deepseek-v3.2": (1.2, 3.8),
    "glm-5.2": (4.0, 35.0),
    "qwen/qwen3.8-max": (6.0, 45.0),
    "anthropic/claude-fable-5": (25.0, 100.0),
    "glm-4.5": (3.0, 9.0),
    "doubao-seed-1.6": (1.5, 4.5),
    "qwen3-max": (3.0, 9.0),
    "moonshotai/kimi-k2.6": (4.0, 12.0),
    "moonshotai/kimi-k3": (5.0, 15.0),
    "qwen3-coder-480b-a35b-instruct": (4.0, 12.0),
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    costs = MODEL_COST.get(model)
    if not costs:
        return 0.01
    input_cost = costs[0] * input_tokens / 1_000_000
    output_cost = costs[1] * output_tokens / 1_000_000
    return round(input_cost + output_cost, 6)


def get_headers(provider: str) -> dict:
    keys = get_api_keys()
    key = keys.get(provider, "")
    if provider in ("openai", "qiniu"):
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    elif provider == "anthropic":
        return {"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
    elif provider == "deepseek":
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    return {}


async def proxy_request(model: str, messages: list, stream: bool = False, max_tokens: int | None = None) -> dict:
    """
    转发请求到上游。
    遇到 SSL/网络错误自动重试一次，大幅降低偶发断流。
    """
    route = MODEL_ROUTES.get(model)
    if not route:
        return {"error": f"Unsupported model: {model}"}

    provider, url = route
    headers = get_headers(provider)
    if not headers.get("Authorization") and not headers.get("x-api-key"):
        return {"error": f"API key not configured for {provider}"}

    payload = {"model": model, "messages": messages, "stream": False}
    if max_tokens:
        payload["max_tokens"] = max_tokens
    if provider == "anthropic":
        payload = {"model": model, "messages": messages, "max_tokens": max_tokens or 4096}

    MAX_RETRIES = 2

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
                resp = await client.post(url, headers=headers, json=payload)
                result = resp.json()
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
            import logging
            _log = logging.getLogger(__name__)
            if attempt < MAX_RETRIES:
                _log.warning(
                    f"上游请求失败（第{attempt+1}次），即将重试: model={model} err={e}"
                )
                continue
            _log.error(f"上游请求最终失败: model={model} payload_keys={list(payload.keys())} err={e}")
            return {"error": str(e)}




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
    headers = get_headers(provider)
    if not headers.get("Authorization") and not headers.get("x-api-key"):
        raise ValueError(f"API key not configured for {provider}")

    payload = {"model": model, "messages": messages, "stream": True}
    if max_tokens:
        payload["max_tokens"] = max_tokens
    if tools:
        payload["tools"] = tools
    if tool_choice:
        payload["tool_choice"] = tool_choice
    if provider == "anthropic":
        payload = {"model": model, "messages": messages, "max_tokens": max_tokens or 4096, "stream": True}

    MAX_RETRIES = 1

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0)) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:
                    input_tok = 0
                    output_tok = 0
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
                                    usage = data.get("usage", {})
                                    if usage:
                                        input_tok = usage.get("prompt_tokens", usage.get("input_tokens", 0))
                                        output_tok = usage.get("completion_tokens", usage.get("output_tokens", 0))
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
                    return
        except Exception as e:
            logging.getLogger(__name__).warning(
                f"上游流式请求失败（第{attempt+1}次），即将重试: model={model} err={e}"
            )
            if attempt >= MAX_RETRIES:
                raise RuntimeError(f"流式请求失败（已重试{MAX_RETRIES}次）: {str(e)}")
