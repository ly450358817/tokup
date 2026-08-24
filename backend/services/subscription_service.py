"""
TokUp · 脉充 — 订阅日配额服务

订阅 = 每日免费额度：配额内不扣余额，超额从余额按正常费率扣，按北京时间 0 点重置。
免费配额仅适用于低价模型（输出价 ≤ FREE_QUOTA_MAX_OUTPUT_COST，默认 ¥15/1M），
GPT-5.5/Claude 等旗舰模型一律走余额，且不消耗免费配额。
"""
import os
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Subscription, UsageRecord

# 免费配额适用的最高输出单价（¥/1M output token），可用环境变量覆盖
FREE_QUOTA_MAX_OUTPUT_COST = float(os.getenv("FREE_QUOTA_MAX_OUTPUT_COST", "15"))

# 不参与订阅免费配额（旗舰/高价模型一律走余额），可用环境变量 FREE_QUOTA_EXCLUDE_MODELS 逗号分隔覆盖
FREE_QUOTA_EXCLUDE_MODELS = set(
    m.strip() for m in os.getenv("FREE_QUOTA_EXCLUDE_MODELS", "").split(",") if m.strip()
) or {"deepseek/deepseek-v4-pro", "deepseek-v3", "deepseek/deepseek-v4-flash-vision-exp"}  # v3/视觉实验版排除：视觉模型图片按尺寸换算 token、最坏成本高，走余额享订阅折扣


# 订阅余额消费折扣（默认 9 折：毛利 1.3x → 1.17x，仍盈利；可用环境变量覆盖）
SUBSCRIPTION_DISCOUNT = float(os.getenv("SUBSCRIPTION_DISCOUNT", "0.9"))


def subscription_discount(user_id: str, db: Session) -> float:
    """有有效订阅返回折扣系数（如 0.9），否则 1.0（不打折）"""
    if get_active_subscription(user_id, db):
        return SUBSCRIPTION_DISCOUNT
    return 1.0


def model_quota_eligible(model: str) -> bool:
    """该模型是否可用订阅免费配额：MODEL_COST 有定价且输出价 ≤ 阈值"""
    from services.ai_service import MODEL_COST
    if model in FREE_QUOTA_EXCLUDE_MODELS:
        return False
    costs = MODEL_COST.get(model)
    if not costs:
        return False
    return costs[1] <= FREE_QUOTA_MAX_OUTPUT_COST


def quota_eligible_models() -> list:
    """当前可用免费配额的低价模型 id（输出价 ≤ 阈值、未被排除、且已在 MODEL_ROUTES 上架可用）"""
    from services.ai_service import MODEL_COST, MODEL_ROUTES
    out = []
    for model, costs in MODEL_COST.items():
        if model in FREE_QUOTA_EXCLUDE_MODELS:
            continue
        if model not in MODEL_ROUTES:
            continue
        if costs[1] <= FREE_QUOTA_MAX_OUTPUT_COST:
            out.append(model)
    return sorted(out, key=lambda m: MODEL_COST[m][1])


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


def today_usage_tokens(user_id: str, db: Session, day_start=None, eligible_only: bool = False) -> float:
    """用户从 day_start 起的累计用量（token）。

    eligible_only=True 时只统计可用免费配额的低价模型用量（付费旗舰模型不消耗免费配额）。
    """
    day_start = day_start or beijing_day_start()
    rows = (
        db.query(UsageRecord)
        .filter(UsageRecord.user_id == user_id, UsageRecord.created_at >= day_start)
        .all()
    )
    total = 0.0
    for r in rows:
        if eligible_only and not model_quota_eligible(r.model):
            continue
        total += float(r.input_tokens or 0) + float(r.output_tokens or 0)
    return total


def quota_remaining(user_id: str, db: Session, daily_limit: float, day_start=None) -> float:
    """当日剩余免费额度（仅统计低价模型用量）"""
    used = today_usage_tokens(user_id, db, day_start, eligible_only=True)
    return max(0.0, float(daily_limit or 0) - used)
