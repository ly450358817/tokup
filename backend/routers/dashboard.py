from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import User, Transaction, ApiKey, UsageRecord
from routers.auth import get_current_user
from services.ai_service import MODEL_ROUTES

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(days: int = 7, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 今日消耗
    today_usage = (
        db.query(func.sum(Transaction.token_amount))
        .filter(
            Transaction.user_id == user.id,
            Transaction.type == "consume",
            Transaction.created_at >= today_start,
        )
        .scalar()
        or 0
    )

    # 近7天趋势
    daily = []
    for i in range(days - 1, -1, -1):
        day = today_start - timedelta(days=i)
        next_day = day + timedelta(days=1)
        used = (
            db.query(func.sum(Transaction.token_amount))
            .filter(
                Transaction.user_id == user.id,
                Transaction.type == "consume",
                Transaction.created_at >= day,
                Transaction.created_at < next_day,
            )
            .scalar()
            or 0
        )
        daily.append({"date": day.strftime("%m-%d"), "usage": float(used)})

    # 各模型用量占比
    key_count = db.query(ApiKey).filter(ApiKey.user_id == user.id, ApiKey.is_active).count()

    # 今日请求数 / 平均响应（真实 usage_records）
    today_records = (
        db.query(UsageRecord)
        .filter(UsageRecord.user_id == user.id, UsageRecord.created_at >= today_start)
        .all()
    )
    today_requests_est = len(today_records)
    _lats = [r.latency_ms for r in today_records if r.latency_ms and r.latency_ms > 0]
    avg_response = round(sum(_lats) / len(_lats), 1) if _lats else 0

    return {
        "balance": user.token_balance,
        "balance_yuan": round(user.token_balance / 100, 2),
        "today_usage": float(today_usage),
        "today_usage_yuan": round(float(today_usage) / 100, 4),
        "total_recharged": user.total_recharged,
        "daily_trend": daily,
        "range_days": days,
        "active_keys": key_count,
        "today_requests": today_requests_est,
        "avg_response_ms": avg_response,
        "status": "online",  # 模拟 API 状态
        "models": {m: True for m in MODEL_ROUTES},
    }


@router.get("/transactions")
def get_txns(limit: int = 20, type_filter: str = "", start_date: str = "",
             end_date: str = "", search: str = "",
             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from services.token_service import get_transactions
    return get_transactions(user.id, db, limit, type_filter, start_date, end_date, search)
