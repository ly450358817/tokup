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
    """订阅购买：暂未开放（历史实现未完成，避免「收钱不交货」）"""
    raise HTTPException(status_code=400, detail="订阅功能暂未开放，请使用「充值」选择体验包/月卡/季卡/年卡")


@router.get("/status")
def subscription_status(user: User = Depends(get_current_user)):
    """返回用户订阅状态（预留）"""
    return {
        "active": False,
        "plan": None,
        "expires_at": None,
        "message": "订阅功能暂未开放，请使用充值",
    }
