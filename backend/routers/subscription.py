"""
订阅套餐路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Transaction
from routers.auth import get_current_user
from datetime import datetime, timezone
from services.token_service import has_completed_recharge

router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# ── 套餐定义 ──
PLANS = {
    "trial": {"label": "体验包", "price": 2990, "tokens": 30000, "days": 7, "daily_limit": 5000, "desc": "低门槛体验"},
  "monthly": {"label": "月卡", "price": 9900, "tokens": 990000, "days": 30, "daily_limit": 33000, "desc": "新用户特惠 · 原价 ¥129"},
    "quarterly": {"label": "季卡", "price": 19900, "tokens": 3000000, "days": 90, "daily_limit": 100000, "desc": "日均¥2.2 · 最受欢迎 ⭐"},
    "yearly": {"label": "年卡", "price": 49900, "tokens": 12000000, "days": 365, "daily_limit": 400000, "desc": "日均¥1.4 · 超值长享"},
}


@router.get("/plans")
def get_plans():
    """返回所有套餐"""
    return {"plans": PLANS}


@router.post("/purchase/{plan_id}")
def purchase_plan(plan_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """用户用余额购买套餐"""
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Invalid plan")

    if not user.is_admin and not has_completed_recharge(user.id, db):
        raise HTTPException(status_code=402, detail="请先充值成功后再购买订阅")

    price = plan["price"]
    if user.token_balance < price:
        raise HTTPException(status_code=400, detail="余额不足")

    # 扣费
    user.token_balance -= price
    user.total_recharged += price / 100

    # 记录
    tx = Transaction(
        user_id=user.id,
        amount=0,
        token_amount=price,
        type="consume",
        status="completed",
        description=f"购买{plan['label']}",
        created_at=datetime.now(timezone.utc),
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

    return {"success": True, "balance": user.token_balance}


@router.get("/status")
def subscription_status(user: User = Depends(get_current_user)):
    """返回用户订阅状态（预留）"""
    return {
        "active": False,
        "plan": None,
        "expires_at": None,
    }
