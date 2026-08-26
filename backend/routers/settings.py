"""
TokUp · 脉充 — Settings
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


class NicknameReq(BaseModel):
    nickname: str = ""


@router.post("/profile/nickname")
def set_nickname(req: NicknameReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """修改昵称"""
    nickname = req.nickname.strip()
    if not nickname:
        raise HTTPException(status_code=400, detail="昵称不能为空")
    if len(nickname) > 30:
        raise HTTPException(status_code=400, detail="昵称最长 30 字")
    user.nickname = nickname
    db.commit()
    return {"success": True, "nickname": user.nickname}


@router.get("/profile")
def get_profile(user: User = Depends(get_current_user)):
    return {
        "email": user.email,
        "nickname": user.nickname,
        "balance": user.token_balance,
        "balance_yuan": round(user.token_balance / 100, 2),
    }
