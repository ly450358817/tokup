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
}

MODEL_ROUTES = {
    # OpenAI
    "gpt-4o": ("openai", "https://api.openai.com/v1/chat/completions"),
    "gpt-4o-mini": ("openai", "https://api.openai.com/v1/chat/completions"),
    "gpt-4-turbo": ("openai", "https://api.openai.com/v1/chat/completions"),
    # Anthropic
    "claude-3-5-sonnet-20241022": ("anthropic", "https://api.anthropic.com/v1/messages"),
    "claude-3-opus-20240229": ("anthropic", "https://api.anthropic.com/v1/messages"),
    "claude-3-haiku-20240307": ("anthropic", "https://api.anthropic.com/v1/messages"),
    # DeepSeek
    "deepseek-chat": ("deepseek", "https://api.deepseek.com/v1/chat/completions"),
    "deepseek-coder": ("deepseek", "https://api.deepseek.com/v1/chat/completions"),
}

MODEL_COST = {
    # model -> (input_per_1M_tokens_cny, output_per_1M_tokens_cny)
    "gpt-4o": (20.0, 60.0),
    "gpt-4o-mini": (1.5, 4.5),
    "gpt-4-turbo": (30.0, 60.0),
    "claude-3-5-sonnet-20241022": (15.0, 75.0),
    "claude-3-opus-20240229": (60.0, 180.0),
    "claude-3-haiku-20240307": (1.5, 6.0),
    "deepseek-chat": (0.5, 1.0),
    "deepseek-coder": (0.5, 1.0),
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """计算本次请求的成本（元）"""
    costs = MODEL_COST.get(model)
    if not costs:
        return 0.01  # fallback
    input_cost = costs[0] * input_tokens / 1_000_000
    output_cost = costs[1] * output_tokens / 1_000_000
    return round(input_cost + output_cost, 6)


def get_headers(provider: str) -> dict:
    key = API_KEYS.get(provider, "")
    if provider == "openai":
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

    payload = {
        "model": model if provider != "anthropic" else model.replace("claude-", ""),
        "messages": messages,
        "stream": stream,
    }
    if provider == "anthropic":
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": 4096,
        }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            result = resp.json()
            # 估算 token 用量
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
