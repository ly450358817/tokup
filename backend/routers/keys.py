import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, ApiKey
from routers.auth import get_current_user
from services.api_key_security import hash_api_key, key_prefix, key_last4, validate_ip_rules

router = APIRouter(prefix="/api/keys", tags=["keys"])


class KeyCreateReq(BaseModel):
    name: str = ""
    monthly_cap: float = 0
    daily_cap: float = 0
    rate_limit: int = 0
    allowed_ips: str = ""
    allowed_models: str = ""


class KeyUpdateReq(BaseModel):
    allowed_ips: str | None = None
    allowed_models: str | None = None


class KeyResp(BaseModel):
    id: str
    key: str
    name: str
    is_active: bool
    rate_limit: int
    monthly_cap: float = 0
    daily_cap: float = 0
    allowed_ips: str = ""
    allowed_models: str = ""
    created_at: str


def generate_api_key() -> str:
    return "tok-" + secrets.token_hex(24)


def _key_resp(k: ApiKey) -> KeyResp:
    return KeyResp(
        id=k.id,
        key=k.key,
        name=k.name,
        is_active=k.is_active,
        rate_limit=k.rate_limit,
        monthly_cap=k.monthly_cap,
        daily_cap=k.daily_cap,
        allowed_ips=k.allowed_ips or "",
        allowed_models=k.allowed_models or "",
        created_at=k.created_at.isoformat(),
    )


@router.get("", response_model=list[KeyResp])
def list_keys(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    keys = db.query(ApiKey).filter(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc()).all()
    return [_key_resp(k) for k in keys]


@router.post("", response_model=KeyResp)
def create_key(req: KeyCreateReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        allowed_ips = validate_ip_rules(req.allowed_ips)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    raw_key = generate_api_key()
    api_key = ApiKey(
        user_id=user.id,
        key=raw_key,
        key_hash=hash_api_key(raw_key),
        key_prefix=key_prefix(raw_key),
        key_last4=key_last4(raw_key),
        name=req.name or "New Key",
        monthly_cap=req.monthly_cap,
        daily_cap=req.daily_cap,
        rate_limit=max(0, int(req.rate_limit or 0)),
        allowed_ips=allowed_ips,
        allowed_models=(req.allowed_models or "").strip(),
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return _key_resp(api_key)


from pydantic import BaseModel
class BatchDeleteReq(BaseModel):
    ids: list[str] = []

@router.patch("/{key_id}")
def update_key_restrictions(key_id: str, req: KeyUpdateReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API Key 不存在")
    if req.allowed_ips is not None:
        try:
            key.allowed_ips = validate_ip_rules(req.allowed_ips)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    if req.allowed_models is not None:
        key.allowed_models = (req.allowed_models or "").strip()
    db.commit()
    db.refresh(key)
    return _key_resp(key)


@router.delete("/{key_id}")
def delete_key(key_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user.id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API Key 不存在")
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
