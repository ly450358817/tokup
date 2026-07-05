from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, ApiKey, UsageRecord
from services.ai_service import proxy_request, calculate_cost, MODEL_ROUTES
from datetime import datetime, timezone
from routers.auth import get_current_user
from services.token_service import deduct_token

import secrets, time, json

router = APIRouter(prefix="/api/v1", tags=["api-proxy"])


class ChatReq(BaseModel):
    model: str = "deepseek-chat"
    messages: list = []
    stream: bool = False


from fastapi import Header as FastAPIHeader

def authenticate_api_key(
    authorization: str = FastAPIHeader(None, alias="authorization"),
    x_auth_token: str = FastAPIHeader(None, alias="x-auth-token"),
    x_api_key: str = FastAPIHeader(None, alias="x-api-key"),
    db: Session = Depends(get_db),
):
    # 支持三种方式传 API Key:
    # 1. Authorization: Bearer <key> (直连)
    # 2. X-Auth-Token: <key> (Nginx 映射)
    # 3. X-API-Key: <key> (备用)
    api_key_str = x_api_key or x_auth_token or authorization or ""
    if api_key_str.startswith("Bearer "):
        api_key_str = api_key_str[7:]
    if not api_key_str:
        raise HTTPException(status_code=401, detail="Missing API key")
    api_key = db.query(ApiKey).filter(ApiKey.key == api_key_str, ApiKey.is_active).first()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key


def resolve_model(model: str) -> str:
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
    model = resolve_model(req.model)
    result = await proxy_request(model, req.messages, False)

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

    resp = result["data"]
    return resp


@router.post("/test/chat")
async def test_chat(req: ChatReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """AI 客服 / 调试对话测试"""
    model = resolve_model(req.model or "deepseek-v3")
    result = await proxy_request(model, req.messages, False)
    if "error" in result:
        return {"success": False, "detail": result["error"]}
    return {"success": True, "data": result["data"]}


@router.post("/responses")
async def responses_api(req: ResponseReq, api_key: ApiKey = Depends(authenticate_api_key), db: Session = Depends(get_db)):
    """支持 SSE 流式返回"""
    if isinstance(req.input, str):
        messages = [{"role": "user", "content": req.input}]
    else:
        messages = req.input if isinstance(req.input, list) else [{"role": "user", "content": str(req.input)}]

    model = resolve_model(req.model)
    if model not in MODEL_ROUTES:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {req.model}")

    resp_id = f"resp_{int(time.time()*1000)}"

    async def generate_sse():
        yield f"event: response.created\ndata: {json.dumps({'id': resp_id, 'object': 'response', 'status': 'in_progress'})}\n\n"
        yield f"event: response.in_progress\ndata: {json.dumps({'id': resp_id, 'status': 'in_progress'})}\n\n"

        result = await proxy_request(model, messages, False)

        if "error" in result:
            yield f"event: response.completed\ndata: {json.dumps({'id': resp_id, 'object': 'response', 'status': 'completed'})}\n\n"
            return

        usage_data = result.get("usage", {})
        cost = usage_data.get("cost", 0.01)
        token_cost = round(cost * 100)
        if token_cost < 1:
            token_cost = 1

        chat_data = result["data"]
        content_text = ""
        try:
            content_text = chat_data["choices"][0]["message"].get("content", "")
        except (KeyError, IndexError):
            pass

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
        deduct_token(api_key.user_id, token_cost, db, f"API: {model}")

        yield f"event: response.output_item.added\ndata: {json.dumps({'output_index': 0, 'item': {'type': 'message', 'status': 'in_progress', 'response_id': resp_id}})}\n\n"

        chunk_size = 4
        for i in range(0, len(content_text), chunk_size):
            chunk = content_text[i:i+chunk_size]
            yield f"event: response.output_text.delta\ndata: {json.dumps({'response_id': resp_id, 'delta': chunk})}\n\n"

        completed = {
            'id': resp_id, 'object': 'response', 'status': 'completed',
            'output': [{'type': 'message', 'status': 'completed',
                       'content': [{'type': 'output_text', 'text': content_text}]}],
            'usage': {
                'input_tokens': usage_data.get("input", 0),
                'output_tokens': usage_data.get("output", 0),
                'total_tokens': usage_data.get("input", 0) + usage_data.get("output", 0),
            }
        }
        yield f"event: response.completed\ndata: {json.dumps(completed)}\n\n"

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/models")
def list_models():
    models = []
    for model, (provider, _) in MODEL_ROUTES.items():
        models.append({"id": model, "provider": provider, "object": "model"})
    return {"data": models}
