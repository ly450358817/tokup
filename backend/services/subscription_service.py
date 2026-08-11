"""
TokUp · 脉充 — 订阅日配额服务

订阅 = 每日免费额度：配额内不扣余额，超额从余额按正常费率扣，按北京时间 0 点重置。
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Subscription, UsageRecord


def beijing_day_start() -> datetime:
    """最近一次北京时间 0 点对应的 UTC 时间"""
    now = datetime.now(timezone.utc)
    shifted = now - timedelta(hours=8)  # 北京 = UTC+8
    return shifted.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(hours=8)


def get_active_subscription(user_id: str, db: Session):
    """当前有效的订阅（未过期且 is_active）"""
    now = datetime.now(timezone.utc)
    return (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.is_active == True,
            Subscription.end_date > now,
        )
        .order_by(Subscription.end_date.desc())
        .first()
    )


def today_usage_tokens(user_id: str, db: Session, day_start=None) -> float:
    """用户从 day_start 起的累计用量（token）"""
    day_start = day_start or beijing_day_start()
    val = (
        db.query(func.coalesce(func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens), 0))
        .filter(UsageRecord.user_id == user_id, UsageRecord.created_at >= day_start)
        .scalar()
    )
    return float(val or 0)


def quota_remaining(user_id: str, db: Session, daily_limit: float, day_start=None) -> float:
    """当日剩余免费额度"""
    used = today_usage_tokens(user_id, db, day_start)
    return max(0.0, float(daily_limit or 0) - used)
