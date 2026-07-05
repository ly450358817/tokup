from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, ApiKey, UsageRecord
from services.ai_service import proxy_request, calculate_cost, MODEL_ROUTES
from datetime import datetime, timezone
from routers.auth import get_current_user
from services.token_service import deduct_token

import secrets
import time

router = APIRouter(prefix="/api/v1", tags=["api-proxy"])


class ChatReq(BaseModel):
    model: str = "deepseek-chat"
    messages: list = []
    stream: bool = False


def authenticate_api_key(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization", "")
    api_key_str = auth_header.replace("Bearer ", "")
    if not api_key_str:
        raise HTTPException(status_code=401, detail="Missing API key")
    api_key = db.query(ApiKey).filter(ApiKey.key == api_key_str, ApiKey.is_active).first()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key


def resolve_model(model: str) -> str:
    """Resolve model name with or without provider prefix"""
    if model in MODEL_ROUTES:
        return model
    for prefix in ["deepseek/", "anthropic/", "openai/", "qwen/", "moonshotai/"]:
        prefixed = prefix + model
        if prefixed in MODEL_ROUTES:
            return prefixed
    return model


class ResponseReq(BaseModel):
    model: str = "deepseek-v4-flash"
    input: str | list = "hello"
    max_output_tokens: int = 1024
    stream: bool = False
    reasoning_effort: str | None = None


@router.post("/chat/completions")
async def chat_completions(req: ChatReq, api_key: ApiKey = Depends(authenticate_api_key), db: Session = Depends(get_db)):
    """兼容 OpenAI SDK 格式的聊天接口 — 返回标准 OpenAI 格式"""
    model = resolve_model(req.model)
    result = await proxy_request(model, req.messages, req.stream)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])

    usage_data = result.get("usage", {})
    cost = usage_data.get("cost", 0.01)
    token_cost = round(cost * 100)
    if token_cost < 1:
        token_cost = 1

    usage_record = UsageRecord(
        user_id=api_key.user_id,
        api_key_id=api_key.id,
        model=model,
        provider=MODEL_ROUTES.get(model, ("unknown", ""))[0],
        input_tokens=usage_data.get("input", 0),
        output_tokens=usage_data.get("output", 0),
        cost_cny=cost,
        status="success",
        created_at=datetime.now(timezone.utc),
    )
    db.add(usage_record)
    db.commit()

    deduct = deduct_token(api_key.user_id, token_cost, db, f"API: {model}")
    if not deduct["success"]:
        raise HTTPException(status_code=402, detail="余额不足")

    # Return standard OpenAI format directly (CC Switch & Codex compatible)
    resp = result["data"]
    if "usage" in resp:
        if "prompt_tokens" not in resp["usage"] and "input" in usage_data:
            resp["usage"]["prompt_tokens"] = usage_data["input"]
        if "completion_tokens" not in resp["usage"] and "output" in usage_data:
            resp["usage"]["completion_tokens"] = usage_data["output"]
    return resp


@router.post("/responses")
async def responses_api(req: ResponseReq, api_key: ApiKey = Depends(authenticate_api_key), db: Session = Depends(get_db)):
    """兼容 OpenAI Responses API 格式"""
    if isinstance(req.input, str):
        messages = [{"role": "user", "content": req.input}]
    else:
        messages = req.input if isinstance(req.input, list) else [{"role": "user", "content": str(req.input)}]

    model = resolve_model(req.model)
    if model not in MODEL_ROUTES:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {req.model}")

    result = await proxy_request(model, messages, req.stream)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])

    usage_data = result.get("usage", {})
    cost = usage_data.get("cost", 0.01)
    token_cost = round(cost * 100)
    if token_cost < 1:
        token_cost = 1

    usage_record = UsageRecord(
        user_id=api_key.user_id,
        api_key_id=api_key.id,
        model=model,
        provider=MODEL_ROUTES.get(model, ("unknown", ""))[0],
        input_tokens=usage_data.get("input", 0),
        output_tokens=usage_data.get("output", 0),
        cost_cny=cost,
        status="success",
        created_at=datetime.now(timezone.utc),
    )
    db.add(usage_record)
    db.commit()

    deduct = deduct_token(api_key.user_id, token_cost, db, f"API: {model}")
    if not deduct["success"]:
        raise HTTPException(status_code=402, detail="余额不足")

    chat_data = result["data"]
    content_text = ""
    if chat_data.get("choices"):
        content_text = chat_data["choices"][0]["message"].get("content", "")

    return {
        "id": chat_data.get("id", f"resp_{secrets.token_hex(12)}"),
        "object": "response",
        "created": chat_data.get("created", int(time.time())),
        "model": req.model,
        "output": [{"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": content_text}]}],
        "usage": {
            "input_tokens": usage_data.get("input", 0),
            "output_tokens": usage_data.get("output", 0),
            "total_tokens": usage_data.get("input", 0) + usage_data.get("output", 0),
        },
    }


@router.get("/models")
def list_models():
    """返回可用模型列表"""
    from services.ai_service import MODEL_ROUTES
    models = []
    for model, (provider, _) in MODEL_ROUTES.items():
        models.append({
            "id": model,
            "provider": provider,
            "object": "model",
        })
    return {"data": models}


class TestChatReq(BaseModel):
    model: str = "deepseek-chat"
    messages: list = []


@router.post("/test/chat")
async def test_chat(req: TestChatReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Test chat with JWT auth (no API Key needed)"""
    from services.ai_service import proxy_request as _proxy
    result = await _proxy(req.model, req.messages, stream=False)

    result = await proxy_request(req.model, req.messages, stream=False)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])

    cost = result.get("usage", {}).get("cost", 0.01)
    token_cost = round(cost * 100)
    if token_cost < 1:
        token_cost = 1

    deduct = deduct_token(user.id, token_cost, db, f"Test: {req.model}")
    if not deduct["success"]:
        raise HTTPException(status_code=402, detail="余额不足")

    usage_data = result.get("usage", {})
    usage_record = UsageRecord(
        user_id=user.id,
        model=req.model,
        provider=MODEL_ROUTES.get(req.model, ("unknown", ""))[0],
        input_tokens=usage_data.get("input", 0),
        output_tokens=usage_data.get("output", 0),
        cost_cny=cost,
        status="success",
        created_at=datetime.now(timezone.utc),
    )
    db.add(usage_record)
    db.commit()

    return {
        "success": True,
        "data": result["data"],
        "cost": cost,
        "balance_remaining": deduct["balance"],
    }
