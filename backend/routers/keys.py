import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, ApiKey
from routers.auth import get_current_user

router = APIRouter(prefix="/api/keys", tags=["keys"])


class KeyCreateReq(BaseModel):
    name: str = ""
    monthly_cap: float = 0
    daily_cap: float = 0


class KeyResp(BaseModel):
    id: str
    key: str
    name: str
    is_active: bool
    rate_limit: int
    monthly_cap: float = 0
    daily_cap: float = 0
    created_at: str


def generate_api_key() -> str:
    return "tok-" + secrets.token_hex(24)


@router.get("", response_model=list[KeyResp])
def list_keys(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    keys = db.query(ApiKey).filter(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc()).all()
    return [
        KeyResp(
            id=k.id,
            key=k.key,
            name=k.name,
            is_active=k.is_active,
            rate_limit=k.rate_limit,
            monthly_cap=k.monthly_cap,
            daily_cap=k.daily_cap,
            created_at=k.created_at.isoformat(),
        )
        for k in keys
    ]


@router.post("", response_model=KeyResp)
def create_key(req: KeyCreateReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    api_key = ApiKey(
        user_id=user.id,
        key=generate_api_key(),
        name=req.name or "New Key",
        monthly_cap=req.monthly_cap,
        daily_cap=req.daily_cap,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return KeyResp(
        id=api_key.id,
        key=api_key.key,
        name=api_key.name,
        is_active=api_key.is_active,
        rate_limit=api_key.rate_limit,
        monthly_cap=api_key.monthly_cap,
        daily_cap=api_key.daily_cap,
        created_at=api_key.created_at.isoformat(),
    )


from pydantic import BaseModel
class BatchDeleteReq(BaseModel):
    ids: list[str] = []

@router.delete("/{key_id}")
def delete_key(key_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    db.delete(key)
    db.commit()
    return {"success": True}

@router.post("/batch-delete")
def batch_delete_keys(req: BatchDeleteReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deleted = 0
    for kid in req.ids:
        key = db.query(ApiKey).filter(ApiKey.id == kid, ApiKey.user_id == user.id).first()
        if key:
            db.delete(key)
            deleted += 1
    db.commit()
    return {"success": True, "deleted": deleted}
