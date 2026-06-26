"""
TokUp · 脉充 — Settings & auto top-up
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


class AutoTopupReq(BaseModel):
    threshold: float = 0
    amount: float = 50


@router.get("/auto-topup")
def get_auto_topup(user: User = Depends(get_current_user)):
    return {
        "enabled": user.auto_topup_threshold > 0,
        "threshold": user.auto_topup_threshold,
        "amount": user.auto_topup_amount,
    }


@router.post("/auto-topup")
def set_auto_topup(req: AutoTopupReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.auto_topup_threshold = req.threshold
    user.auto_topup_amount = req.amount
    db.commit()
    return {"success": True, "threshold": req.threshold, "amount": req.amount}


@router.get("/profile")
def get_profile(user: User = Depends(get_current_user)):
    return {
        "email": user.email,
        "nickname": user.nickname,
        "balance": user.token_balance,
        "balance_yuan": round(user.token_balance / 100, 2),
        "auto_topup": {
            "enabled": user.auto_topup_threshold > 0,
            "threshold": user.auto_topup_threshold,
            "amount": user.auto_topup_amount,
        },
    }
