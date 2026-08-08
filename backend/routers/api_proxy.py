from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, ApiKey, UsageRecord
from services.ai_service import proxy_request, calculate_cost, MODEL_ROUTES
from datetime import datetime, timezone
from routers.auth import get_current_user
from services.token_service import reserve_token, settle_reserved, has_completed_recharge

import secrets, time, json, asyncio

router = APIRouter(prefix="/api/v1", tags=["api-proxy"])


class ChatReq(BaseModel):
    model: str = "deepseek-chat"
    messages: list = []
    stream: bool = False
    max_tokens: int | None = None
    max_completion_tokens: int | None = None


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


def _ensure_paid(api_key, db):
    """只有充值成功的用户才能调用 API（管理员可测试）"""
    user = db.query(User).filter(User.id == api_key.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.is_admin:
        return user
    if not has_completed_recharge(user.id, db):
        raise HTTPException(status_code=402, detail="请先充值成功后再调用 API")
    return user


def _capture_key_identity(api_key):
    """提交事务前先固定 key 身份，避免流式生成器里 ORM 对象失效"""
    return api_key.user_id, api_key.id


def estimate_request_cost(model: str, messages: list) -> int:
    """预扣估算：输入按字符数、输出按保守上限，余额不足直接拒绝"""
    try:
        est_input = sum(len(str(m.get("content", ""))) for m in messages) or 1
        est_output = 4096
        cost = calculate_cost(model, est_input, est_output)
        return max(round(cost * 100), 1)
    except Exception:
        return 1


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
    instructions: str | None = None


def _content_part_to_text(part) -> str:
    """把 Responses 内容部件(content part)转成纯文本。"""
    if isinstance(part, str):
        return part
    if isinstance(part, dict):
        t = part.get("type")
        if t in ("input_text", "output_text", "text"):
            return part.get("text", "") or ""
        # input_image / input_audio 等暂时跳过
    return ""


def _normalize_responses_input(input_data, instructions=None) -> list:
    """把 OpenAI Responses 的 input 转换成 chat messages（content 统一为字符串）。"""
    messages = []
    if instructions:
        messages.append({"role": "system", "content": instructions})
    if isinstance(input_data, str):
        messages.append({"role": "user", "content": input_data})
        return messages
    if not isinstance(input_data, list):
        messages.append({"role": "user", "content": str(input_data)})
        return messages
    for item in input_data:
        if isinstance(item, str):
            messages.append({"role": "user", "content": item})
            continue
        if not isinstance(item, dict):
            continue
        # 取 role：Responses 消息可能是 {type:"message", role:...} 或直接 {role:...}
        role = item.get("role") or "user"
        content = item.get("content")
        if content is None:
            continue
        if isinstance(content, list):
            text = "".join(_content_part_to_text(p) for p in content).strip()
            if not text:
                continue
            messages.append({"role": role, "content": text})
        else:
            messages.append({"role": role, "content": str(content)})
    if not messages:
        messages.append({"role": "user", "content": ""})
    return messages


@router.post("/chat/completions")
async def chat_completions(req: ChatReq, api_key: ApiKey = Depends(authenticate_api_key), db: Session = Depends(get_db)):
    model = resolve_model(req.model)
    _u = _ensure_paid(api_key, db)
    _uid, _kid = _capture_key_identity(api_key)
    _initial_balance = _u.token_balance

    if req.stream:
        # 先预扣，防止断连/超长输出白嫖
        _need = estimate_request_cost(model, req.messages)
        if _u.token_balance < _need:
            raise HTTPException(status_code=402, detail=f"余额不足，本次调用至少需要 {_need} token，请先充值")
        _res = reserve_token(_uid, _need, db, f"API预扣: {model}")
        if not _res["success"]:
            raise HTTPException(status_code=402, detail="余额不足，请先充值")
        try:
            from services.ai_service import proxy_stream_request as _psr
            _messages = req.messages
            async def _forward():
                _usage_data = None
                _fwd_content = ""
                _settled = False
                _balance_after = None
                _t0 = time.monotonic()

                def _settle():
                    nonlocal _settled, _balance_after
                    if _settled:
                        return
                    _settled = True
                    _latency = int((time.monotonic() - _t0) * 1000)
                    if _usage_data:
                        _cost = _usage_data.get("cost", 0.01)
                        _input_tok = _usage_data.get("input", 0)
                        _output_tok = _usage_data.get("output", 0)
                    else:
                        _input_tok = sum(len(str(m.get("content", ""))) for m in _messages) // 2
                        _output_tok = max(1, len(_fwd_content) // 2) if _fwd_content else 0
                        _cost = calculate_cost(model, _input_tok, _output_tok) if _output_tok else 0.0
                    _tc = max(round(_cost * 100), 1) if _output_tok else 0
                    try:
                        if _tc > 0:
                            _record = UsageRecord(
                                user_id=_uid, api_key_id=_kid, model=model,
                                provider=MODEL_ROUTES.get(model, ("unknown", ""))[0],
                                input_tokens=_input_tok,
                                output_tokens=_output_tok,
                                cost_cny=_cost, status="success",
                                latency_ms=_latency,
                                created_at=datetime.now(timezone.utc),
                            )
                            db.add(_record)
                        _r = settle_reserved(_uid, _need, _tc, db, f"API: {model}")
                        _balance_after = _r.get("balance", _initial_balance)
                    except Exception:
                        pass

                try:
                    async for _chunk in _psr(model, _messages):
                        if isinstance(_chunk, bytes):
                            if _chunk.startswith(b"__USAGE__:"):
                                try:
                                    _usage_data = json.loads(_chunk[len(b"__USAGE__:"):].decode())
                                except Exception:
                                    pass
                            elif b"[DONE]" in _chunk:
                                pass  # 跳过上游的 [DONE]，由我们自己统一发送
                            else:
                                _text = _chunk.decode("utf-8", errors="replace")
                                for _ln in _text.split("\n"):
                                    if _ln.startswith("data: ") and "[DONE]" not in _ln:
                                        try:
                                            _obj = json.loads(_ln[6:])
                                            _dc = _obj.get("choices", [{}])[0].get("delta", {}).get("content")
                                            if _dc:
                                                _fwd_content += _dc
                                        except Exception:
                                            pass
                                yield _text
                except StopAsyncIteration:
                    pass
                except Exception:
                    import json as _j, time as _t
                    _e = _j.dumps({"id": f"cmpl-{int(_t.time()*1000)}", "object": "chat.completion.chunk", "created": int(_t.time()), "model": model, "choices": [{"index": 0, "delta": {}, "logprobs": None, "finish_reason": "stop"}]})
                    yield f"data: {_e}\n\n"
                finally:
                    _settle()

                if _balance_after is not None and _balance_after < 200:
                    import time as _t
                    _w = json.dumps({
                        "id": f"cmpl-{int(_t.time()*1000)}",
                        "object": "chat.completion.chunk",
                        "created": int(_t.time()),
                        "model": model,
                        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                        "warning": f"余额不足 ({_balance_after:.0f} token)，请尽快充值",
                        "recharge_url": "https://tokup.net"
                    })
                    yield f"data: {_w}\n\n"

                yield "data: [DONE]\n\n"
            return StreamingResponse(_forward(), media_type="text/event-stream")
        except Exception as e:
            settle_reserved(_uid, _need, 0, db, f"API退回: {model}")
            raise HTTPException(status_code=502, detail=str(e))

    # 非流式：同样先预扣，返回前按实际用量结算
    _need = estimate_request_cost(model, req.messages)
    if _u.token_balance < _need:
        raise HTTPException(status_code=402, detail=f"余额不足，本次调用至少需要 {_need} token，请先充值")
    _res = reserve_token(_uid, _need, db, f"API预扣: {model}")
    if not _res["success"]:
        raise HTTPException(status_code=402, detail="余额不足，请先充值")
    _max_tokens = req.max_tokens or req.max_completion_tokens
    _t0 = time.monotonic()
    result = await proxy_request(model, req.messages, False, max_tokens=_max_tokens)
    _latency = int((time.monotonic() - _t0) * 1000)
    if "error" in result:
        settle_reserved(_uid, _need, 0, db, f"API退回: {model}")
        raise HTTPException(status_code=502, detail=result["error"])
    usage_data = result.get("usage", {})
    cost = usage_data.get("cost", 0.01)
    token_cost = max(round(cost * 100), 1)
    usage_record = UsageRecord(
        user_id=_uid, api_key_id=_kid, model=model,
        provider=MODEL_ROUTES.get(model, ("unknown", ""))[0],
        input_tokens=usage_data.get("input", 0),
        output_tokens=usage_data.get("output", 0),
        cost_cny=cost, status="success", latency_ms=_latency,
        created_at=datetime.now(timezone.utc),
    )
    db.add(usage_record)
    _deduct = settle_reserved(_uid, _need, token_cost, db, f"API: {model}")
    if not _deduct["success"]:
        return JSONResponse(
            status_code=402,
            content={
                "detail": "余额不足，请充值后续费",
                "error": {
                    "message": "余额不足 | 充值: https://tokup.net",
                    "type": "insufficient_balance",
                    "recharge_url": "https://tokup.net"
                }
            }
        )
    return result["data"]


@router.post("/test/chat")
async def test_chat(req: ChatReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """AI 客服 / 调试对话测试（同样要求充值成功）"""
    if not user.is_admin and not has_completed_recharge(user.id, db):
        return {"success": False, "detail": "请先充值成功后再测试"}
    _model_t = resolve_model(req.model or "deepseek-v3")
    _need = estimate_request_cost(_model_t, req.messages)
    if user.token_balance < _need:
        return {"success": False, "detail": f"余额不足，本次测试至少需要 {_need} token，请先充值"}
    _res = reserve_token(user.id, _need, db, f"API预扣: {_model_t}")
    if not _res["success"]:
        return {"success": False, "detail": "余额不足"}
    model = _model_t
    _t0 = time.monotonic()
    result = await proxy_request(model, req.messages, False)
    _latency = int((time.monotonic() - _t0) * 1000)
    if "error" in result:
        settle_reserved(user.id, _need, 0, db, f"API退回: {model}")
        return {"success": False, "detail": result["error"]}
    usage_data = result.get("usage", {})
    cost = usage_data.get("cost", 0.01)
    token_cost = max(round(cost * 100), 1)
    usage_record = UsageRecord(
        user_id=user.id, api_key_id=None, model=model,
        provider=MODEL_ROUTES.get(model, ("unknown", ""))[0],
        input_tokens=usage_data.get("input", 0),
        output_tokens=usage_data.get("output", 0),
        cost_cny=cost, status="success", latency_ms=_latency,
        created_at=datetime.now(timezone.utc),
    )
    db.add(usage_record)
    _deduct = settle_reserved(user.id, _need, token_cost, db, f"API: {model}")
    if not _deduct["success"]:
        return {"success": False, "detail": "余额不足"}
    return {"success": True, "data": result["data"]}


@router.post("/responses")
async def responses_api(req: ResponseReq, api_key: ApiKey = Depends(authenticate_api_key), db: Session = Depends(get_db)):
    """支持 SSE 流式返回"""
    _uid, _kid = _capture_key_identity(api_key)
    messages = _normalize_responses_input(req.input, req.instructions)

    model = resolve_model(req.model)
    if model not in MODEL_ROUTES:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {req.model}")

    _u = _ensure_paid(api_key, db)
    _need = estimate_request_cost(model, messages)
    if _u.token_balance < _need:
        raise HTTPException(status_code=402, detail=f"余额不足，本次调用至少需要 {_need} token，请先充值")
    _res = reserve_token(_uid, _need, db, f"API预扣: {model}")
    if not _res["success"]:
        raise HTTPException(status_code=402, detail="余额不足，请先充值")

    resp_id = f"resp_{int(time.time()*1000)}"

    async def generate_sse():
        yield f"event: response.created\ndata: {json.dumps({'id': resp_id, 'object': 'response', 'status': 'in_progress'})}\n\n"
        yield f"event: response.in_progress\ndata: {json.dumps({'id': resp_id, 'status': 'in_progress'})}\n\n"

        _t0 = time.monotonic()
        result = await proxy_request(model, messages, False, max_tokens=req.max_output_tokens)
        _latency = int((time.monotonic() - _t0) * 1000)

        if "error" in result:
            settle_reserved(_uid, _need, 0, db, f"API退回: {model}")
            err_msg = str(result["error"])
            yield f"event: response.failed\ndata: {json.dumps({'type': 'error', 'code': 'upstream_error', 'message': err_msg, 'response_id': resp_id})}\n\n"
            yield f"event: response.completed\ndata: {json.dumps({'id': resp_id, 'object': 'response', 'status': 'failed', 'error': {'code': 'upstream_error', 'message': err_msg}, 'output': []})}\n\n"
            return

        usage_data = result.get("usage", {})
        cost = usage_data.get("cost", 0.01)
        token_cost = max(round(cost * 100), 1)

        chat_data = result["data"]
        content_text = ""
        try:
            content_text = chat_data["choices"][0]["message"].get("content", "")
        except (KeyError, IndexError):
            pass

        usage_record = UsageRecord(
            user_id=_uid,
            api_key_id=_kid,
            model=model,
            provider=MODEL_ROUTES.get(model, ("unknown", ""))[0],
            input_tokens=usage_data.get("input", 0),
            output_tokens=usage_data.get("output", 0),
            cost_cny=cost,
            status="success",
            latency_ms=_latency,
            created_at=datetime.now(timezone.utc),
        )
        db.add(usage_record)
        _deduct = settle_reserved(_uid, _need, token_cost, db, f"API: {model}")

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
