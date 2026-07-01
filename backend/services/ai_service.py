"""
AI API 路由服务 — 根据模型自动选择最优上游
"""
import os
import hashlib
import json
from typing import Optional
import httpx

API_KEYS = {
    "openai": os.getenv("OPENAI_API_KEY", ""),
    "anthropic": os.getenv("ANTHROPIC_API_KEY", ""),
    "deepseek": os.getenv("DEEPSEEK_API_KEY", ""),
    "qiniu": os.getenv("QINIU_API_KEY", ""),
}

QINIU_ENDPOINT = "https://api.qnaigc.com/v1/chat/completions"

MODEL_ROUTES = {
    # OpenAI (直连)
    "gpt-4o": ("openai", "https://api.openai.com/v1/chat/completions"),
    "gpt-4o-mini": ("openai", "https://api.openai.com/v1/chat/completions"),
    "gpt-4-turbo": ("openai", "https://api.openai.com/v1/chat/completions"),
    # Anthropic (直连)
    "claude-3-5-sonnet-20241022": ("anthropic", "https://api.anthropic.com/v1/messages"),
    "claude-3-opus-20240229": ("anthropic", "https://api.anthropic.com/v1/messages"),
    "claude-3-haiku-20240307": ("anthropic", "https://api.anthropic.com/v1/messages"),
    # DeepSeek → 七牛云（合规上游）
    "deepseek-v3": ("qiniu", QINIU_ENDPOINT),
    "deepseek-v3.1": ("qiniu", QINIU_ENDPOINT),
    "deepseek-r1": ("qiniu", QINIU_ENDPOINT),
    "deepseek/deepseek-v4-pro": ("qiniu", QINIU_ENDPOINT),
    "deepseek/deepseek-v4-flash": ("qiniu", QINIU_ENDPOINT),
    # Anthropic → 七牛云（合规上游）
    "anthropic/claude-fable-5": ("qiniu", QINIU_ENDPOINT),
    # 国产模型 → 七牛云（合规上游）
    "qwen/qwen3.7-max": ("qiniu", QINIU_ENDPOINT),
    "glm-4.5": ("qiniu", QINIU_ENDPOINT),
    "doubao-seed-1.6": ("qiniu", QINIU_ENDPOINT),
}

MODEL_COST = {
    # OpenAI (input_cny, output_cny per 1M tokens)
    "gpt-4o": (20.0, 60.0),
    "gpt-4o-mini": (1.5, 4.5),
    "gpt-4-turbo": (30.0, 60.0),
    "claude-3-5-sonnet-20241022": (15.0, 75.0),
    "claude-3-opus-20240229": (60.0, 180.0),
    "claude-3-haiku-20240307": (1.5, 6.0),
    # DeepSeek via 七牛云
    "deepseek-v3": (0.5, 1.0),
    "deepseek-v3.1": (0.5, 1.0),
    "deepseek-r1": (1.0, 2.0),
    "deepseek/deepseek-v4-pro": (0.8, 1.6),
    "deepseek/deepseek-v4-flash": (0.3, 0.6),
    # Claude Fable 5 via 七牛云
    "anthropic/claude-fable-5": (25.0, 100.0),
    # 国产模型 via 七牛云
    "qwen/qwen3.7-max": (5.0, 15.0),
    "glm-4.5": (3.0, 9.0),
    "doubao-seed-1.6": (1.5, 4.5),
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    costs = MODEL_COST.get(model)
    if not costs:
        return 0.01
    input_cost = costs[0] * input_tokens / 1_000_000
    output_cost = costs[1] * output_tokens / 1_000_000
    return round(input_cost + output_cost, 6)


def get_headers(provider: str) -> dict:
    key = API_KEYS.get(provider, "")
    if provider in ("openai", "qiniu"):
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    elif provider == "anthropic":
        return {"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
    elif provider == "deepseek":
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    return {}


async def proxy_request(model: str, messages: list, stream: bool = False) -> dict:
    route = MODEL_ROUTES.get(model)
    if not route:
        return {"error": f"Unsupported model: {model}"}

    provider, url = route
    headers = get_headers(provider)
    if not headers.get("Authorization") and not headers.get("x-api-key"):
        return {"error": f"API key not configured for {provider}"}

    payload = {"model": model, "messages": messages, "stream": stream}
    if provider == "anthropic":
        payload = {"model": model, "messages": messages, "max_tokens": 4096}

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
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
            return {"error": str(e)}
