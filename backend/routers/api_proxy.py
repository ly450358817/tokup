from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, ApiKey, UsageRecord
from services.ai_service import proxy_request, calculate_cost, MODEL_ROUTES
from datetime import datetime, timezone
from routers.auth import get_current_user
from services.token_service import deduct_token

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


@router.post("/chat/completions")
async def chat_completions(req: ChatReq, api_key: ApiKey = Depends(authenticate_api_key), db: Session = Depends(get_db)):
    """兼容 OpenAI SDK 格式的聊天接口"""
    result = await proxy_request(req.model, req.messages, req.stream)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])

    usage_data = result.get("usage", {})
    cost = usage_data.get("cost", 0.01)
    token_cost = round(cost * 100)
    if token_cost < 1:
        token_cost = 1

    # ── 记录使用明细（合规审计）──
    usage_record = UsageRecord(
        user_id=api_key.user_id,
        api_key_id=api_key.id,
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

    deduct = deduct_token(api_key.user_id, token_cost, db, f"API: {req.model}")
    if not deduct["success"]:
        raise HTTPException(status_code=402, detail="Insufficient balance")

    return {
        "success": True,
        "data": result["data"],
        "cost": cost,
        "balance_remaining": deduct["balance"],
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

    # ── 记录使用明细 ——
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
