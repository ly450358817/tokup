from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import User
from routers.auth import get_current_user

router = APIRouter(prefix="/api/invite", tags=["invite"])


@router.get("/info")
def invite_info(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """返回当前用户的邀请码和邀请统计"""
    if not user.invite_code:
        import uuid
        user.invite_code = uuid.uuid4().hex[:8].upper()
        db.commit()
    return {
        "invite_code": user.invite_code,
        "invite_count": user.invite_count or 0,
        "invite_bonus": user.invite_count * 500,  # 每人奖励 500 分
        "invite_link": f"https://tokup.net/register?code={user.invite_code}",
    }


@router.get("/top")
def invite_top(db: Session = Depends(get_db), limit: int = 10):
    """邀请排行榜"""
    top = db.query(User).filter(User.invite_count > 0).order_by(User.invite_count.desc()).limit(limit).all()
    return [
        {
            "nickname": u.nickname or u.email.split("@")[0],
            "invite_count": u.invite_count or 0,
        }
        for u in top
    ]
