"""
订阅套餐路由 — 日配额模型：购买后用余额开通，订阅期内每天有免费额度（配额内不扣余额，超额从余额扣）。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Transaction, Subscription
from routers.auth import get_current_user
from datetime import datetime, timezone, timedelta
from services.subscription_service import get_active_subscription, beijing_day_start, today_usage_tokens

router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# ── 套餐定义 ──
PLANS = {
    "trial": {"label": "体验订阅", "price": 2990, "days": 7, "daily_limit": 5000, "desc": "低门槛体验 · 7天每日 5000 Token 免费"},
    "monthly": {"label": "月度订阅", "price": 9900, "days": 30, "daily_limit": 33000, "desc": "新用户特惠 · 30天每日 33000 Token 免费"},
    "quarterly": {"label": "季度订阅", "price": 19900, "days": 90, "daily_limit": 100000, "desc": "日均¥2.2 · 90天每日 100000 Token 免费"},
    "yearly": {"label": "年度订阅", "price": 49900, "days": 365, "daily_limit": 400000, "desc": "日均¥1.4 · 365天每日 400000 Token 免费"},
}


@router.get("/plans")
def get_plans():
    """返回所有订阅套餐"""
    return {"plans": PLANS}


@router.post("/purchase/{plan_id}")
def purchase_plan(plan_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """用余额购买订阅：立即开通每日免费配额"""
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Invalid plan")

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
