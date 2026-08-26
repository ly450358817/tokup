from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, case

from database import get_db
from models import User, Transaction, ApiKey, UsageRecord
from routers.auth import get_current_user
from services.ai_service import MODEL_ROUTES
from services.subscription_service import beijing_day_start

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(days: int = 7, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    # 北京时间自然日零点（与订阅配额"北京时间0点重置"口径一致）
    today_start = beijing_day_start()

    # 今日消耗（API 实际消耗，排除"购买订阅"流水）
    today_usage = (
        db.query(func.sum(Transaction.token_amount))
        .filter(
            Transaction.user_id == user.id,
            Transaction.type == "consume",
            (Transaction.description.is_(None)) | (~Transaction.description.like("%订阅%")),
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
                (Transaction.description.is_(None)) | (~Transaction.description.like("%订阅%")),
                Transaction.created_at >= day,
                Transaction.created_at < next_day,
            )
            .scalar()
            or 0
        )
        daily.append({"date": (day + timedelta(hours=8)).strftime("%m-%d"), "usage": float(used)})

    # 各模型近24h健康状态（按真实调用错误率；无调用=unknown，不做假绿点）
    key_count = db.query(ApiKey).filter(ApiKey.user_id == user.id, ApiKey.is_active).count()
    model_health = {}
    for _m, _cnt, _errs in (
        db.query(
            UsageRecord.model,
            func.count(UsageRecord.id),
            func.sum(case((UsageRecord.status != "success", 1), else_=0)),
        )
        .filter(UsageRecord.created_at >= now - timedelta(hours=24))
        .group_by(UsageRecord.model)
        .all()
    ):
        _cnt = int(_cnt or 0)
        _errs = int(_errs or 0)
        # 需同时满足：24h 内至少 2 次失败 且 失败率 >2%（单次偶发抖动不标异常，避免误报）
        model_health[_m] = "degraded" if (_cnt > 0 and _errs >= 2 and _errs / _cnt > 0.02) else "healthy"

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
        "models": model_health,
    }


@router.get("/transactions")
def get_txns(limit: int = 20, type_filter: str = "", start_date: str = "",
             end_date: str = "", search: str = "",
             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from services.token_service import get_transactions
    return get_transactions(user.id, db, limit, type_filter, start_date, end_date, search)
