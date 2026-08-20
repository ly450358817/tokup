"""
订阅套餐路由 — 日配额模型：购买后用余额开通，订阅期内每天有免费额度（配额内不扣余额，超额从余额扣）。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Transaction, Subscription
from routers.auth import get_current_user
from datetime import datetime, timezone, timedelta
from services.subscription_service import get_active_subscription, beijing_day_start, today_usage_tokens, quota_eligible_models

router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# ── 套餐定义 ──
# 2026-08-20 订阅额度重定价 v2（用户确认方案A）：越买越多 + 日均价越低
# 每日免费额度：体验5万 < 月30万 < 季35万 < 年40万（递增，避免"年卡不如季卡"）
# 最坏情况（免费额度薅满+全走输出，当前价）毛利：体验96%/月73%/季52%/年12%，均不亏
# ⚠️ 年卡 12% 最薄：若 flash/v3.2 上游峰谷涨价致年卡逼近亏损，周维护须下调年卡额度或把 flash 移出免费额度
PLANS = {
    "trial": {"label": "体验订阅", "price": 2990, "days": 7, "daily_limit": 50000, "desc": "7天试用 · 每日 5万 Token 免费 + 全模型余额消费 9 折"},
    "monthly": {"label": "月度订阅", "price": 9900, "days": 30, "daily_limit": 300000, "desc": "每日 30万 Token 免费（月 900万）+ 全模型余额消费 9 折"},
    "quarterly": {"label": "季度订阅", "price": 19900, "days": 90, "daily_limit": 350000, "desc": "每日 35万 Token 免费 + 全模型余额消费 9 折，日均 ¥2.2"},
    "yearly": {"label": "年度订阅", "price": 49900, "days": 365, "daily_limit": 400000, "desc": "每日 40万 Token 免费（最多）+ 整年 9 折，日均仅 ¥1.4 最省"},
}


@router.get("/plans")
def get_plans():
    """返回所有订阅套餐 + 当前可用免费配额的低价模型（单一事实来源，随 MODEL_COST/阈值变化自动更新）"""
    return {"plans": PLANS, "eligible_models": quota_eligible_models()}


@router.post("/purchase/{plan_id}")
def purchase_plan(plan_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """用余额购买订阅：立即开通每日免费配额"""
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="订阅套餐无效")

    # 防白嫖：未真实充值过（体验金/邀请奖励不算）不能购买订阅
    from services.token_service import has_completed_recharge
    if not user.is_admin and not has_completed_recharge(user.id, db):
        raise HTTPException(status_code=400, detail="未充值用户不能购买订阅，请先充值")

    price = plan["price"]
    if user.token_balance < price:
        raise HTTPException(status_code=400, detail="余额不足，请先充值")

    # 扣费
    user.token_balance -= price
    user.total_recharged += price / 100

    now = datetime.now(timezone.utc)
    sub = Subscription(
        user_id=user.id,
        plan_id=plan_id,
        plan_label=plan["label"],
        daily_limit=plan["daily_limit"],
        is_active=True,
        start_date=now,
        end_date=now + timedelta(days=plan["days"]),
        created_at=now,
    )
    db.add(sub)

    tx = Transaction(
        user_id=user.id,
        amount=0,
        token_amount=price,
        type="consume",
        status="completed",
        description=f"购买订阅·{plan['label']}",
        created_at=now,
    )
    db.add(tx)

    # 订阅消费分成：10% 给邀请人
    if user.referred_by:
        referrer = db.query(User).filter(User.id == user.referred_by).first()
        if referrer:
            comm_amount = int(price * 0.1)
            if comm_amount > 0:
                referrer.token_balance += comm_amount
                db.add(Transaction(
                    user_id=referrer.id,
                    amount=0,
                    token_amount=comm_amount,
                    type="recharge",
                    status="completed",
                    description="提成 (" + str(int(price)) + " 订阅 x 10%)",
                    created_at=datetime.now(timezone.utc),
                ))

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "balance": user.token_balance,
        "plan": plan_id,
        "expires": sub.end_date.isoformat(),
        "daily_limit": plan["daily_limit"],
    }


@router.get("/status")
def subscription_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """返回当前订阅状态（含当日配额使用情况）"""
    sub = get_active_subscription(user.id, db)
    if not sub:
        return {"active": False, "plan": None, "expires_at": None}
    daily_limit = sub.daily_limit or 0
    used = today_usage_tokens(user.id, db, beijing_day_start(), eligible_only=True)
    used_all = today_usage_tokens(user.id, db, beijing_day_start())
    return {
        "active": True,
        "plan": sub.plan_id,
        "plan_label": sub.plan_label,
        "expires_at": sub.end_date.isoformat(),
        "daily_limit": daily_limit,
        "today_used": used,
        "today_used_all": used_all,
        "today_remaining": max(0.0, float(daily_limit) - used),
    }
