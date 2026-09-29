"""站内内容安全告警：用户在网站弹窗查看并确认「我知道了」。"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserWarning
from routers.auth import get_current_user

router = APIRouter(prefix="/api/me", tags=["warnings"])


@router.get("/warnings")
def list_warnings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(UserWarning)
        .filter(UserWarning.user_id == user.id, UserWarning.acknowledged == False)
        .order_by(UserWarning.created_at.desc())
        .all()
    )
    return {
        "warnings": [
            {
                "id": r.id,
                "title": r.title,
                "message": r.message,
                "category": r.category,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ]
    }


@router.post("/warnings/{wid}/ack")
def ack_warning(wid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    w = db.query(UserWarning).filter(UserWarning.id == wid, UserWarning.user_id == user.id).first()
    if not w:
        raise HTTPException(status_code=404, detail="告警不存在")
    w.acknowledged = True
    w.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
