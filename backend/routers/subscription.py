"""
订阅套餐路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, Transaction
from routers.auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/subscription", tags=["subscription"])

# ── 套餐定义 ──
PLANS = {
    "monthly": {"label": "月卡", "price": 9900, "tokens": 990000, "days": 30},
    "quarterly": {"label": "季卡", "price": 19900, "tokens": 3000000, "days": 90},
    "yearly": {"label": "年卡", "price": 59900, "tokens": 12000000, "days": 365},
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

    price = plan["price"]
    if user.token_balance < price:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # 扣费
    user.token_balance -= price
    user.total_recharged += price

    # 记录
    tx = Transaction(
        user_id=user.id,
        amount=-price,
        tx_type="subscription",
        description=f"购买{plan['label']}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(tx)
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
