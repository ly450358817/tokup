from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import SessionLocal
from models import User, Transaction, ApiKey, ConversationLog
from routers.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/stats")
def admin_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_recharged = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.status == "completed",
        Transaction.type == "recharge",
        Transaction.payment_method != "",
    ).scalar() or 0
    total_consumed = db.query(func.coalesce(func.sum(Transaction.token_amount), 0)).filter(Transaction.type == "consume", Transaction.status == "completed").scalar() or 0
    total_keys = db.query(func.count(ApiKey.id)).scalar() or 0
    active_keys = db.query(func.count(ApiKey.id)).filter(ApiKey.is_active == True).scalar() or 0
    return {
        "total_users": total_users,
        "total_recharged": round(total_recharged, 2),
        "total_consumed": total_consumed,
        "total_keys": total_keys,
        "active_keys": active_keys,
    }


@router.get("/conversations")
def list_conversations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    user_id: str = "",
    email: str = "",
    model: str = "",
    endpoint: str = "",
    start: str = "",
    end: str = "",
    limit: int = 50,
    offset: int = 0,
):
    """管理员查询对话存档（仅管理员；按用户/模型/入口/时间过滤）"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    q = db.query(ConversationLog)
    if email:
        _u = db.query(User).filter(User.email == email).first()
        if _u:
            q = q.filter(ConversationLog.user_id == _u.id)
        else:
            q = q.filter(False)
    if user_id:
        q = q.filter(ConversationLog.user_id == user_id)
    if model:
        q = q.filter(ConversationLog.model == model)
    if endpoint:
        q = q.filter(ConversationLog.endpoint == endpoint)
    if start:
        try:
            from datetime import datetime as _dt
            q = q.filter(ConversationLog.created_at >= _dt.fromisoformat(start))
        except Exception:
            pass
    if end:
        try:
            from datetime import datetime as _dt, timedelta as _td
            q = q.filter(ConversationLog.created_at < _dt.fromisoformat(end) + _td(days=1))
        except Exception:
            pass
    total = q.count()
    rows = q.order_by(ConversationLog.created_at.desc()).offset(offset).limit(min(limit, 200)).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "api_key_id": r.api_key_id,
                "model": r.model,
                "endpoint": r.endpoint,
                "request_json": r.request_json,
                "response_json": r.response_json,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "cost_cny": r.cost_cny,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }
