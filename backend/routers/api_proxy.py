from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import User, ApiKey, UsageRecord, ConversationLog
from services.ai_service import proxy_request, calculate_cost, MODEL_ROUTES
from datetime import datetime, timezone
from routers.auth import get_current_user
from services.token_service import reserve_token, settle_reserved

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
    """余额 > 0 即可调用 API（注册体验金/邀请奖励均可体验，管理员可测试）；余额用尽后提示充值。"""
    user = db.query(User).filter(User.id == api_key.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.is_admin:
        return user
    if (user.token_balance or 0) <= 0:
        # 订阅用户余额为 0 仍可用每日免费配额（配额内调用不扣余额）；非订阅用户仍拦截
        from services.subscription_service import get_active_subscription
        if not get_active_subscription(user.id, db):
            raise HTTPException(status_code=402, detail="余额不足，请先充值")
    return user


def _key_usage_tokens(db: Session, api_key_id: str, since) -> float:
    """API Key 在 since 之后的累计用量（token）"""
    val = (
        db.query(func.coalesce(func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens), 0))
        .filter(UsageRecord.api_key_id == api_key_id, UsageRecord.created_at >= since)
        .scalar()
    )
    return float(val or 0)


def _check_key_caps(api_key: ApiKey, db: Session):
    """强制 API Key 每日/每月额度上限（0 = 不限）"""
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = day_start.replace(day=1)
    if api_key.daily_cap and api_key.daily_cap > 0:
        used = _key_usage_tokens(db, api_key.id, day_start)
        if used >= api_key.daily_cap:
            raise HTTPException(status_code=429, detail=f"已达今日额度上限（{api_key.daily_cap:.0f} token），明天再来")
    if api_key.monthly_cap and api_key.monthly_cap > 0:
        used = _key_usage_tokens(db, api_key.id, month_start)
        if used >= api_key.monthly_cap:
            raise HTTPException(status_code=429, detail=f"已达本月额度上限（{api_key.monthly_cap:.0f} token）")


def _capture_key_identity(api_key):
    """提交事务前先固定 key 身份，避免流式生成器里 ORM 对象失效"""
    return api_key.user_id, api_key.id


def estimate_request_cost(model: str, messages: list) -> int:
    """预扣估算：输入按字符数、输出按保守上限，余额不足直接拒绝"""
    try:
        est_input = sum(len(str(m.get("content", ""))) for m in messages) or 1
        est_output = 4096
        cost = calculate_cost(model, est_input, est_output)
        return max(round(cost * 100), 1) if cost > 0 else 0
    except Exception:
        return 1


def _log_conversation(db, *, user_id, api_key_id, model, endpoint, request_messages,
                      response_content=None, input_tokens=0, output_tokens=0,
                      cost_cny=0.0, status="success"):
    """对话全量存档：把请求消息与响应内容写入 conversation_logs（失败不影响主流程）"""
    try:
        req_txt = json.dumps(request_messages, ensure_ascii=False, default=str) if request_messages is not None else ""
        if isinstance(response_content, (dict, list)):
            resp_txt = json.dumps(response_content, ensure_ascii=False, default=str)
        elif response_content is None:
            resp_txt = ""
        else:
            resp_txt = str(response_content)
        if len(req_txt) > 1_000_000:
            req_txt = req_txt[:1_000_000] + "...[截断]"
        if len(resp_txt) > 1_000_000:
            resp_txt = resp_txt[:1_000_000] + "...[截断]"
        db.add(ConversationLog(
            user_id=user_id, api_key_id=api_key_id, model=model, endpoint=endpoint,
            request_json=req_txt, response_json=resp_txt,
            input_tokens=int(input_tokens or 0), output_tokens=int(output_tokens or 0),
            cost_cny=float(cost_cny or 0.0), status=status,
            created_at=datetime.now(timezone.utc),
        ))
    except Exception:
        import logging
        logging.getLogger("tokup.log").exception("对话存档失败: model=%s", model)


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
    max_output_tokens: int | None = None
    stream: bool = False
    reasoning_effort: str | None = None
    instructions: str | None = None
    tools: list | None = None
    tool_choice: str | dict | None = None
    parallel_tool_calls: bool | None = None


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
    """把 OpenAI Responses 的 input 转换成 chat messages，支持消息、历史工具调用(tool_calls)与工具结果。"""
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
        t = item.get("type")
        if t == "message" or "role" in item:
            role = item.get("role") or "user"
            if role == "developer":
                role = "system"
            content = item.get("content")
            text = ""
            if isinstance(content, list):
                for part in content:
                    text += _content_part_to_text(part)
            elif content is not None:
                text = str(content)
            text = text.strip()
            if not text:
                continue
            messages.append({"role": role, "content": text})
        elif t in ("function_call", "custom_tool_call"):
            # 助手历史里的工具调用 -> assistant.tool_calls
            name = item.get("name") or ""
            if not name:
                continue
            raw_args = item.get("arguments")
            if raw_args is None:
                raw_args = item.get("input") or ""
            if not isinstance(raw_args, str):
                raw_args = json.dumps(raw_args, ensure_ascii=False)
            call_id = item.get("call_id") or item.get("id") or f"call_{len(messages)}"
            messages.append({
                "role": "assistant",
                "tool_calls": [{
                    "id": call_id,
                    "type": "function",
                    "function": {"name": name, "arguments": raw_args},
                }],
            })
        elif t in ("function_call_output", "custom_tool_call_output"):
            # 工具执行结果 -> tool message
            call_id = item.get("call_id") or ""
            output = item.get("output")
            if isinstance(output, dict):
                output = output.get("output") or output.get("content") or json.dumps(output, ensure_ascii=False)
            elif isinstance(output, list):
                parts = []
                for part in output:
                    if isinstance(part, dict):
                        parts.append(_content_part_to_text(part) or part.get("text", ""))
                    else:
                        parts.append(str(part))
                output = "\n".join(p for p in parts if p)
            else:
                output = str(output or "")
            messages.append({"role": "tool", "tool_call_id": call_id, "content": output})
    if not messages:
        messages.append({"role": "user", "content": ""})
    return messages


def _convert_tools(tools) -> list | None:
    """把 Codex 的 Responses tools 转成 chat/completions 的 legacy function tools。
    namespace / custom 类工具暂时不支持（跳过），保证核心 shell/文件等 function 工具可用。"""
    if not tools:
        return None
    out = []
    for t in tools:
        if not isinstance(t, dict):
            continue
        if t.get("type") != "function":
            continue
        out.append({
            "type": "function",
            "function": {
                "name": t.get("name", ""),
                "description": t.get("description") or "",
                "parameters": t.get("parameters") or {"type": "object", "properties": {}},
            },
        })
    return out or None


def _convert_tool_choice(tool_choice):
    """把 Responses 的 tool_choice 转成 chat/completions 格式。"""
    if not tool_choice:
        return "auto"
    if isinstance(tool_choice, str):
        return tool_choice  # auto / none / required
    if isinstance(tool_choice, dict):
        name = tool_choice.get("name") or (tool_choice.get("function") or {}).get("name")
        if name:
            return {"type": "function", "function": {"name": name}}
    return "auto"


@router.post("/chat/completions")
async def chat_completions(req: ChatReq, api_key: ApiKey = Depends(authenticate_api_key), db: Session = Depends(get_db)):
    model = resolve_model(req.model)
    if model not in MODEL_ROUTES:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {req.model}")
    _u = _ensure_paid(api_key, db)
    _check_key_caps(api_key, db)
    _uid, _kid = _capture_key_identity(api_key)
    _initial_balance = _u.token_balance

    # 订阅日配额：免费配额仅适用低价模型，配额内用量不扣余额
    from services.subscription_service import get_active_subscription, beijing_day_start, today_usage_tokens, model_quota_eligible
    _sub = get_active_subscription(_u.id, db)
    _day_start = beijing_day_start()
    _eligible = model_quota_eligible(model)
    _quota_remaining = 0.0
    if _sub and _eligible:
        _quota_used = today_usage_tokens(_u.id, db, _day_start, eligible_only=True)
        _quota_remaining = max(0.0, (_sub.daily_limit or 0) - _quota_used)
    _need = estimate_request_cost(model, req.messages)
    _need_balance = max(0, _need - _quota_remaining)

    if req.stream:
        # 先预扣（仅预扣超出免费配额的部分），防止断连/超长输出白嫖
        if _u.token_balance < _need_balance:
            raise HTTPException(status_code=402, detail=f"余额不足，本次调用至少需要 {_need_balance} token，请先充值")
        _res = reserve_token(_uid, _need_balance, db, f"API预扣: {model}")
        if not _res["success"]:
            raise HTTPException(status_code=402, detail="余额不足，请先充值")
        try:
            from services.ai_service import proxy_stream_request as _psr
            _messages = req.messages
            async def _forward():
                _usage_data = None
                _fwd_content = ""
                _fwd_reasoning = ""
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
                        _input_tok = _usage_data.get("input", 0)
                        _output_tok = _usage_data.get("output", 0)
                        _cost = _usage_data.get("cost")
                        if _cost is None:
                            _cost = calculate_cost(model, _input_tok, _output_tok)
                    else:
                        _input_tok = sum(len(str(m.get("content", ""))) for m in _messages) // 2
                        _output_tok = max(1, len(_fwd_content) // 2) if _fwd_content else 0
                        _cost = calculate_cost(model, _input_tok, _output_tok) if _output_tok else 0.0
                    _tc = max(round(_cost * 100), 1) if (_output_tok and _cost > 0) else 0
                    try:
                        # 订阅配额：本次先消耗当日剩余免费额度，超出部分才从余额扣（仅低价模型）
                        _q_used_now = today_usage_tokens(_uid, db, _day_start, eligible_only=True)
                        _q_rem = max(0.0, (_sub.daily_limit or 0) - _q_used_now) if (_sub and _eligible) else 0.0
                        _q_covered = min(_tc, _q_rem)
                        _balance_charge = max(0, _tc - _q_covered)
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
                        _log_conversation(
                            db, user_id=_uid, api_key_id=_kid, model=model, endpoint="chat",
                            request_messages=_messages,
                            response_content={"content": _fwd_content, "reasoning": _fwd_reasoning},
                            input_tokens=_input_tok, output_tokens=_output_tok, cost_cny=_cost,
                        )
                        _r = settle_reserved(_uid, _need_balance, _balance_charge, db, f"API: {model}")
                        _balance_after = _r.get("balance", _initial_balance)
                    except Exception as _se:
                        # 结算异常时退回预扣，避免用户余额被无声冻结
                        try:
                            settle_reserved(_uid, _need_balance, 0, db, f"API退回: {model}")
                        except Exception:
                            pass
                        import logging
                        logging.getLogger("tokup.payment").warning("流式结算失败: model=%s err=%s", model, _se)

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
                                            _delta = _obj.get("choices", [{}])[0].get("delta", {}) or {}
                                            _dc = _delta.get("content") or ""
                                            if _dc:
                                                _fwd_content += _dc
                                            _rc = _delta.get("reasoning_content") or ""
                                            if _rc:
                                                _fwd_reasoning += _rc
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
            settle_reserved(_uid, _need_balance, 0, db, f"API退回: {model}")
            raise HTTPException(status_code=502, detail=str(e))

    # 非流式：同样先预扣（仅预扣超出免费配额的部分），返回前按实际用量结算
    if _u.token_balance < _need_balance:
        raise HTTPException(status_code=402, detail=f"余额不足，本次调用至少需要 {_need_balance} token，请先充值")
    _res = reserve_token(_uid, _need_balance, db, f"API预扣: {model}")
    if not _res["success"]:
        raise HTTPException(status_code=402, detail="余额不足，请先充值")
    _max_tokens = req.max_tokens or req.max_completion_tokens
    _t0 = time.monotonic()
    result = await proxy_request(model, req.messages, False, max_tokens=_max_tokens)
    _latency = int((time.monotonic() - _t0) * 1000)
    if "error" in result:
        _log_conversation(db, user_id=_uid, api_key_id=_kid, model=model, endpoint="chat",
                          request_messages=req.messages, response_content={"error": result["error"]},
                          status="error")
        settle_reserved(_uid, _need_balance, 0, db, f"API退回: {model}")
        raise HTTPException(status_code=502, detail=result["error"])
    usage_data = result.get("usage", {})
    cost = usage_data.get("cost")
    if cost is None:
        cost = calculate_cost(model, usage_data.get("input", 0), usage_data.get("output", 0))
    token_cost = max(round(cost * 100), 1) if cost > 0 else 0
    # 订阅配额：本次先消耗当日剩余免费额度，超出部分才从余额扣（仅低价模型）
    _q_used_now = today_usage_tokens(_uid, db, _day_start, eligible_only=True)
    _q_rem = max(0.0, (_sub.daily_limit or 0) - _q_used_now) if (_sub and _eligible) else 0.0
    _q_covered = min(token_cost, _q_rem)
    _balance_charge = max(0, token_cost - _q_covered)
    _deduct = settle_reserved(_uid, _need_balance, _balance_charge, db, f"API: {model}")
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
    db.add(UsageRecord(
        user_id=_uid, api_key_id=_kid, model=model,
        provider=MODEL_ROUTES.get(model, ("unknown", ""))[0],
        input_tokens=usage_data.get("input", 0),
        output_tokens=usage_data.get("output", 0),
        cost_cny=cost, status="success", latency_ms=_latency,
        created_at=datetime.now(timezone.utc),
    ))
    _log_conversation(
        db, user_id=_uid, api_key_id=_kid, model=model, endpoint="chat",
        request_messages=req.messages, response_content=result["data"],
        input_tokens=usage_data.get("input", 0), output_tokens=usage_data.get("output", 0),
        cost_cny=cost,
    )
    db.commit()
    return result["data"]


@router.post("/test/chat")
async def test_chat(req: ChatReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """AI 客服 / 调试对话测试（余额 > 0 即可体验，订阅用户享受每日免费配额）"""
    if not user.is_admin and (user.token_balance or 0) <= 0:
        # 订阅用户余额为 0 仍可用每日免费配额
        from services.subscription_service import get_active_subscription as _gas
        if not _gas(user.id, db):
            return {"success": False, "detail": "余额不足，请先充值"}
    from services.subscription_service import get_active_subscription, beijing_day_start, today_usage_tokens, model_quota_eligible
    _model_t = resolve_model(req.model or "deepseek-v3")
    if _model_t not in MODEL_ROUTES:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {req.model}")
    _sub = get_active_subscription(user.id, db)
    _day_start = beijing_day_start()
    _eligible = model_quota_eligible(_model_t)
    _quota_remaining = 0.0
    if _sub and _eligible:
        _quota_used = today_usage_tokens(user.id, db, _day_start, eligible_only=True)
        _quota_remaining = max(0.0, (_sub.daily_limit or 0) - _quota_used)
    _need = estimate_request_cost(_model_t, req.messages)
    _need_balance = max(0, _need - _quota_remaining)
    if user.token_balance < _need_balance:
        return {"success": False, "detail": f"余额不足，本次测试至少需要 {_need_balance} token，请先充值"}
    _res = reserve_token(user.id, _need_balance, db, f"API预扣: {_model_t}")
    if not _res["success"]:
        return {"success": False, "detail": "余额不足"}
    model = _model_t
    _t0 = time.monotonic()
    result = await proxy_request(model, req.messages, False)
    _latency = int((time.monotonic() - _t0) * 1000)
    if "error" in result:
        _log_conversation(db, user_id=user.id, api_key_id=None, model=model, endpoint="test",
                          request_messages=req.messages, response_content={"error": result["error"]},
                          status="error")
        settle_reserved(user.id, _need_balance, 0, db, f"API退回: {model}")
        return {"success": False, "detail": result["error"]}
    usage_data = result.get("usage", {})
    cost = usage_data.get("cost")
    if cost is None:
        cost = calculate_cost(model, usage_data.get("input", 0), usage_data.get("output", 0))
    token_cost = max(round(cost * 100), 1) if cost > 0 else 0
    # 订阅配额：本次先消耗当日剩余免费额度，超出部分才从余额扣（仅低价模型）
    _q_used_now = today_usage_tokens(user.id, db, _day_start, eligible_only=True)
    _q_rem = max(0.0, (_sub.daily_limit or 0) - _q_used_now) if (_sub and _eligible) else 0.0
    _q_covered = min(token_cost, _q_rem)
    _balance_charge = max(0, token_cost - _q_covered)
    _deduct = settle_reserved(user.id, _need_balance, _balance_charge, db, f"API: {model}")
    if not _deduct["success"]:
        return {"success": False, "detail": "余额不足"}
    db.add(UsageRecord(
        user_id=user.id, api_key_id=None, model=model,
        provider=MODEL_ROUTES.get(model, ("unknown", ""))[0],
        input_tokens=usage_data.get("input", 0),
        output_tokens=usage_data.get("output", 0),
        cost_cny=cost, status="success", latency_ms=_latency,
        created_at=datetime.now(timezone.utc),
    ))
    _log_conversation(
        db, user_id=user.id, api_key_id=None, model=model, endpoint="test",
        request_messages=req.messages, response_content=result["data"],
        input_tokens=usage_data.get("input", 0), output_tokens=usage_data.get("output", 0),
        cost_cny=cost,
    )
    db.commit()
    return {"success": True, "data": result["data"]}


@router.post("/responses")
async def responses_api(req: ResponseReq, api_key: ApiKey = Depends(authenticate_api_key), db: Session = Depends(get_db)):
    """SSE 流式返回：真流式 + 心跳保活 + OpenAI Responses 标准事件格式，支持工具调用（function_call）"""
    _uid, _kid = _capture_key_identity(api_key)
    messages = _normalize_responses_input(req.input, req.instructions)
    _tools_legacy = _convert_tools(req.tools)
    _tool_choice = _convert_tool_choice(req.tool_choice)

    model = resolve_model(req.model)
    if model not in MODEL_ROUTES:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {req.model}")

    _u = _ensure_paid(api_key, db)
    _check_key_caps(api_key, db)
    # 订阅日配额：免费配额仅适用低价模型，配额内用量不扣余额
    from services.subscription_service import get_active_subscription, beijing_day_start, today_usage_tokens, model_quota_eligible
    _sub = get_active_subscription(_u.id, db)
    _day_start = beijing_day_start()
    _eligible = model_quota_eligible(model)
    _quota_remaining = 0.0
    if _sub and _eligible:
        _quota_used = today_usage_tokens(_u.id, db, _day_start, eligible_only=True)
        _quota_remaining = max(0.0, (_sub.daily_limit or 0) - _quota_used)
    _need = estimate_request_cost(model, messages)
    _need_balance = max(0, _need - _quota_remaining)
    if _u.token_balance < _need_balance:
        raise HTTPException(status_code=402, detail=f"余额不足，本次调用至少需要 {_need_balance} token，请先充值")
    _res = reserve_token(_uid, _need_balance, db, f"API预扣: {model}")
    if not _res["success"]:
        raise HTTPException(status_code=402, detail="余额不足，请先充值")

    resp_id = f"resp_{int(time.time()*1000)}"
    item_seq = {"n": 0}

    def _next_idx():
        i = item_seq["n"]
        item_seq["n"] += 1
        return i

    def _sse(event_name: str, payload: dict) -> str:
        payload = dict(payload)
        payload.setdefault("type", event_name)
        return f"event: {event_name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"

    async def generate_sse():
        from services.ai_service import proxy_stream_request as _psr

        # 基础事件：立即发出，客户端马上能收到首字节（避开 60s first-byte timeout）
        yield _sse("response.created", {"response": {"id": resp_id, "object": "response", "status": "in_progress"}})
        yield _sse("response.in_progress", {"response": {"id": resp_id, "object": "response", "status": "in_progress"}})

        _t0 = time.monotonic()
        _usage_data = None
        _content_text = ""
        _reasoning_text = ""
        _settled = False
        _msg_item_id = f"msg_{int(time.time()*1000)}"
        _rs_item_id = f"rs_{int(time.time()*1000)}"
        _msg_added = False
        _rs_added = False
        _rs_idx = 0
        _msg_idx = 0
        _tool_items = []   # 完成的 function_call item（按输出顺序）

        def _settle(ok: bool):
            nonlocal _settled
            if _settled:
                return
            _settled = True
            _latency = int((time.monotonic() - _t0) * 1000)
            if ok and _usage_data:
                _in = _usage_data.get("input", 0)
                _out = _usage_data.get("output", 0)
                _cost = _usage_data.get("cost")
                if _cost is None:
                    _cost = calculate_cost(model, _in, _out)
            else:
                _in = sum(len(str(m.get("content", ""))) for m in messages) // 2 or 1
                _out = max(1, len(_content_text) // 2) if _content_text else 0
                _cost = calculate_cost(model, _in, _out) if _out else 0.0
            _tc = max(round(_cost * 100), 1) if (_out and _cost > 0) else 0
            try:
                # 订阅配额：本次先消耗当日剩余免费额度，超出部分才从余额扣（仅低价模型）
                _q_used_now = today_usage_tokens(_uid, db, _day_start, eligible_only=True)
                _q_rem = max(0.0, (_sub.daily_limit or 0) - _q_used_now) if (_sub and _eligible) else 0.0
                _q_covered = min(_tc, _q_rem)
                _balance_charge = max(0, _tc - _q_covered)
                if ok and _tc > 0:
                    _record = UsageRecord(
                        user_id=_uid, api_key_id=_kid, model=model,
                        provider=MODEL_ROUTES.get(model, ("unknown", ""))[0],
                        input_tokens=_in, output_tokens=_out,
                        cost_cny=_cost, status="success", latency_ms=_latency,
                        created_at=datetime.now(timezone.utc),
                    )
                    db.add(_record)
                _log_conversation(
                    db, user_id=_uid, api_key_id=_kid, model=model, endpoint="responses",
                    request_messages=messages,
                    response_content={"content": _content_text, "reasoning": _reasoning_text, "tool_calls": _tool_items} if ok else None,
                    input_tokens=_in, output_tokens=_out, cost_cny=_cost,
                    status="success" if ok else "error",
                )
                settle_reserved(_uid, _need_balance, _balance_charge if ok else 0, db, f"API: {model}" if ok else f"API退回: {model}")
            except Exception as _se:
                try:
                    settle_reserved(_uid, _need_balance, 0, db, f"API退回: {model}")
                except Exception:
                    pass
                import logging
                logging.getLogger("tokup.payment").warning("Responses 结算失败: model=%s err=%s", model, _se)

        # 后台任务消费上游流并解析成 Responses 事件；主循环负责心跳保活。
        q: asyncio.Queue = asyncio.Queue()

        async def _consume():
            nonlocal _usage_data, _content_text, _reasoning_text, _msg_added, _rs_added, _rs_idx, _msg_idx, _tool_items
            _tool_state = {}   # index -> {fc_id, call_id, name, args, added, out_idx}
            try:
                async for _chunk in _psr(model, messages, max_tokens=req.max_output_tokens,
                                         tools=_tools_legacy, tool_choice=_tool_choice):
                    if isinstance(_chunk, bytes):
                        if _chunk.startswith(b"__USAGE__:"):
                            try:
                                _usage_data = json.loads(_chunk[len(b"__USAGE__:"):].decode())
                            except Exception:
                                pass
                            continue
                        if b"[DONE]" in _chunk:
                            continue
                        _text = _chunk.decode("utf-8", errors="replace")
                        for _ln in _text.split("\n"):
                            if not _ln.startswith("data: ") or "[DONE]" in _ln:
                                continue
                            try:
                                _obj = json.loads(_ln[6:])
                            except Exception:
                                continue
                            _delta = _obj.get("choices", [{}])[0].get("delta", {}) or {}
                            _rc = _delta.get("reasoning_content") or _delta.get("reasoning") or ""
                            _dc = _delta.get("content") or ""
                            if _rc:
                                if not _rs_added:
                                    _rs_added = True
                                    _rs_idx = _next_idx()
                                    await q.put(("sse", _sse("response.output_item.added", {
                                        "output_index": _rs_idx,
                                        "item": {"type": "reasoning", "id": _rs_item_id, "summary": []},
                                    })))
                                _reasoning_text += _rc
                                await q.put(("sse", _sse("response.reasoning_summary_text.delta", {
                                    "item_id": _rs_item_id, "output_index": _rs_idx, "summary_index": 0, "delta": _rc,
                                })))
                            if _dc:
                                if not _msg_added:
                                    _msg_added = True
                                    _msg_idx = _next_idx()
                                    await q.put(("sse", _sse("response.output_item.added", {
                                        "output_index": _msg_idx,
                                        "item": {"type": "message", "id": _msg_item_id, "role": "assistant", "content": []},
                                    })))
                                _content_text += _dc
                                await q.put(("sse", _sse("response.output_text.delta", {
                                    "item_id": _msg_item_id, "output_index": _msg_idx, "delta": _dc,
                                })))
                            # 工具调用：上游 chat/completions 的 delta.tool_calls 逐块到达
                            for _tc in (_delta.get("tool_calls") or []):
                                if not isinstance(_tc, dict):
                                    continue
                                _tidx = _tc.get("index", 0)
                                _st = _tool_state.get(_tidx)
                                _f = _tc.get("function") or {}
                                if _st is None:
                                    _st = {"fc_id": f"fc_{int(time.time()*1000)}_{_tidx}",
                                           "call_id": _tc.get("id") or "",
                                           "name": _f.get("name") or "",
                                           "args": "", "added": False, "out_idx": None}
                                    _tool_state[_tidx] = _st
                                if _f.get("name"):
                                    _st["name"] = _f["name"]
                                if _tc.get("id") and not _st["call_id"]:
                                    _st["call_id"] = _tc["id"]
                                _args_chunk = _f.get("arguments") or ""
                                if _args_chunk:
                                    _st["args"] += _args_chunk
                                if not _st["added"] and (_st["name"] or _args_chunk):
                                    _st["added"] = True
                                    _st["out_idx"] = _next_idx()
                                    await q.put(("sse", _sse("response.output_item.added", {
                                        "output_index": _st["out_idx"],
                                        "item": {"type": "function_call", "id": _st["fc_id"],
                                                 "call_id": _st["call_id"], "name": _st["name"],
                                                 "arguments": _st["args"]},
                                    })))
                                if _args_chunk:
                                    await q.put(("sse", _sse("response.function_call_arguments.delta", {
                                        "item_id": _st["fc_id"], "output_index": _st["out_idx"], "delta": _args_chunk,
                                    })))
                # 流结束：收尾所有工具调用
                for _tidx in sorted(_tool_state):
                    _st = _tool_state[_tidx]
                    if not _st["added"]:
                        _st["added"] = True
                        _st["out_idx"] = _next_idx()
                        await q.put(("sse", _sse("response.output_item.added", {
                            "output_index": _st["out_idx"],
                            "item": {"type": "function_call", "id": _st["fc_id"],
                                     "call_id": _st["call_id"], "name": _st["name"],
                                     "arguments": _st["args"]},
                        })))
                    await q.put(("sse", _sse("response.function_call_arguments.done", {
                        "item_id": _st["fc_id"], "output_index": _st["out_idx"], "arguments": _st["args"],
                    })))
                    _item = {"type": "function_call", "id": _st["fc_id"], "call_id": _st["call_id"],
                             "name": _st["name"], "arguments": _st["args"]}
                    _tool_items.append(_item)
                    await q.put(("sse", _sse("response.output_item.done", {
                        "output_index": _st["out_idx"], "item": _item,
                    })))
            except Exception as _e:
                await q.put(("error", str(_e)))
            finally:
                await q.put(("done", None))

        _consumer = asyncio.create_task(_consume())
        try:
            while True:
                try:
                    _kind, _data = await asyncio.wait_for(q.get(), timeout=25)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"   # SSE 注释行：客户端忽略，但能防 CC Switch/nginx/Cloudflare 断流
                    continue
                if _kind == "done":
                    break
                if _kind == "error":
                    raise RuntimeError(_data)
                yield _data
        except Exception as _e:
            _settle(False)
            _err = str(_e)
            yield _sse("response.failed", {
                "response": {
                    "id": resp_id, "object": "response", "status": "failed",
                    "error": {"code": "upstream_error", "message": _err},
                    "output": [],
                }
            })
            return
        finally:
            _consumer.cancel()
            try:
                await _consumer
            except Exception:
                pass
            # 断流/异常也结算：有内容按实际扣费、无内容退回预扣，避免余额泄漏
            _settle(True)

        # 正常结束：收尾事件 + 计费（幂等，_settled 已置位）

        if _rs_added:
            yield _sse("response.reasoning_summary_text.done", {
                "item_id": _rs_item_id, "output_index": _rs_idx, "summary_index": 0, "text": _reasoning_text,
            })
            yield _sse("response.output_item.done", {
                "output_index": _rs_idx,
                "item": {"type": "reasoning", "id": _rs_item_id,
                         "summary": [{"type": "summary_text", "text": _reasoning_text}]},
            })

        if _msg_added:
            yield _sse("response.output_text.done", {
                "item_id": _msg_item_id, "output_index": _msg_idx, "text": _content_text,
            })
            yield _sse("response.output_item.done", {
                "output_index": _msg_idx,
                "item": {"type": "message", "id": _msg_item_id, "role": "assistant",
                         "content": [{"type": "output_text", "text": _content_text}]},
            })

        _out_usage = _usage_data or {}
        completed_output = []
        if _rs_added:
            completed_output.append({"type": "reasoning", "id": _rs_item_id,
                                     "summary": [{"type": "summary_text", "text": _reasoning_text}]})
        if _msg_added:
            completed_output.append({"type": "message", "role": "assistant",
                                     "content": [{"type": "output_text", "text": _content_text}]})
        completed_output.extend(_tool_items)
        # 有未执行的工具调用时 turn 未结束（Codex 会执行工具后继续请求）
        end_turn = not bool(_tool_items)
        completed = {
            "id": resp_id, "object": "response", "status": "completed", "end_turn": end_turn,
            "output": completed_output,
            "usage": {
                "input_tokens": _out_usage.get("input", 0),
                "output_tokens": _out_usage.get("output", 0),
                "total_tokens": _out_usage.get("input", 0) + _out_usage.get("output", 0),
            },
        }
        yield _sse("response.completed", {"response": completed})

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
