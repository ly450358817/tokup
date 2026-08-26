from datetime import datetime, timedelta, timezone
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
    total_consumed = db.query(func.coalesce(func.sum(Transaction.token_amount), 0)).filter(
        Transaction.type == "consume",
        Transaction.status == "completed",
        (Transaction.description.is_(None)) | (~Transaction.description.like("%订阅%")),
    ).scalar() or 0
    total_keys = db.query(func.count(ApiKey.id)).scalar() or 0
    active_keys = db.query(func.count(ApiKey.id)).filter(ApiKey.is_active == True).scalar() or 0
    return {
        "total_users": total_users,
        "total_recharged": round(total_recharged, 2),
        "total_consumed": total_consumed,
        "total_keys": total_keys,
        "active_keys": active_keys,
    }


@router.get("/stats/daily")
def admin_daily_stats(
    days: int = 30,
    start: str = "",
    end: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """管理员每日数据：注册数 / 充值金额 / 消耗 token / 新增 API Key（按北京时间自然日汇总）。

    查询方式（二选一）：
      - days=N：返回最近 N 天（含今天），默认 30
      - start=YYYY-MM-DD&end=YYYY-MM-DD：返回指定日期区间（日历按月查询用；end 缺省为今天）

    口径与 /stats 汇总保持一致：
      - 充值：type=recharge、status=completed、且带支付方式（排除赠送/邀请提成等非真实充值）
      - 消耗：type=consume、status=completed 的 token_amount 合计（不含购买订阅）
      - 注册 / API Key：按创建时间计数
    日期按北京时间（UTC+8）切分；created_at 存的是 UTC，SQLite 里 +8 小时后再取日期。
    """
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    tz = timezone(timedelta(hours=8))
    today = datetime.now(timezone.utc).astimezone(tz).date()

    # ── 确定查询区间 ──
    if start:
        try:
            start_day = datetime.strptime(start, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="start 格式应为 YYYY-MM-DD")
        end_day = today
        if end:
            try:
                end_day = datetime.strptime(end, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="end 格式应为 YYYY-MM-DD")
        if end_day < start_day:
            start_day, end_day = end_day, start_day
        if (end_day - start_day).days > 366:
            raise HTTPException(status_code=400, detail="单次查询最多 366 天")
    else:
        days = max(1, min(int(days), 365))
        end_day = today
        start_day = today - timedelta(days=days - 1)

    # 北京自然日 0 点对应的 UTC 时刻
    start_utc = datetime(start_day.year, start_day.month, start_day.day, tzinfo=tz).astimezone(timezone.utc)

    def _bday(col):
        # SQLite 专用：UTC 时间 +8 小时取日期，得到北京时间自然日
        return func.date(col, "+8 hours").label("d")

    registrations = dict(
        db.query(_bday(User.created_at), func.count(User.id))
        .filter(User.created_at >= start_utc)
        .group_by("d")
        .all()
    )
    recharges = {
        d: (float(amt or 0), int(cnt or 0))
        for d, amt, cnt in db.query(
            _bday(Transaction.created_at),
            func.coalesce(func.sum(Transaction.amount), 0),
            func.count(Transaction.id),
        )
        .filter(
            Transaction.type == "recharge",
            Transaction.status == "completed",
            Transaction.payment_method != "",
            Transaction.created_at >= start_utc,
        )
        .group_by("d")
        .all()
    }
    consumed = dict(
        db.query(_bday(Transaction.created_at), func.coalesce(func.sum(Transaction.token_amount), 0))
        .filter(
            Transaction.type == "consume",
            Transaction.status == "completed",
            (Transaction.description.is_(None)) | (~Transaction.description.like("%订阅%")),
            Transaction.created_at >= start_utc,
        )
        .group_by("d")
        .all()
    )
    api_keys = dict(
        db.query(_bday(ApiKey.created_at), func.count(ApiKey.id))
        .filter(ApiKey.created_at >= start_utc)
        .group_by("d")
        .all()
    )

    daily = []
    for i in range((end_day - start_day).days + 1):
        day = (start_day + timedelta(days=i)).isoformat()
        amt, cnt = recharges.get(day, (0.0, 0))
        daily.append({
            "date": day,
            "registrations": int(registrations.get(day, 0)),
            "recharge_amount": round(amt, 2),
            "recharge_count": cnt,
            "consumed_tokens": float(consumed.get(day, 0)),
            "api_keys_created": int(api_keys.get(day, 0)),
        })

    return {
        "range_days": (end_day - start_day).days + 1,
        "timezone": "Asia/Shanghai (UTC+8)",
        "daily": daily,
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
