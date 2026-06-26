from datetime import datetime, timedelta, timezone
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_db
from models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"])
security = HTTPBearer()

SECRET_KEY = os.getenv("TOKUP_SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"

# --- Rate limiter (in-memory, per IP) ---
_rate_limit_store: dict = {}

def _rate_limit(key: str, max_attempts: int = 20, window: int = 60):
    now = time.time()
    timestamps = _rate_limit_store.get(key, [])
    timestamps = [t for t in timestamps if now - t < window]
    if len(timestamps) >= max_attempts:
        raise HTTPException(status_code=429, detail="Too many attempts")
    timestamps.append(now)
    _rate_limit_store[key] = timestamps

def _validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not any(c.isupper() for c in password):
        raise HTTPException(status_code=400, detail="Password needs an uppercase letter")
    if not any(c.islower() for c in password):
        raise HTTPException(status_code=400, detail="Password needs a lowercase letter")
    if not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="Password needs a digit")

def _validate_email(email: str):
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address")

ALGORITHM = "HS256"

# --- Rate limiter (in-memory, per IP) ---
_rate_limit_store: dict = {}

def _rate_limit(key: str, max_attempts: int = 20, window: int = 60):
    now = time.time()
    timestamps = _rate_limit_store.get(key, [])
    timestamps = [t for t in timestamps if now - t < window]
    if len(timestamps) >= max_attempts:
        raise HTTPException(status_code=429, detail="Too many attempts")
    timestamps.append(now)
    _rate_limit_store[key] = timestamps

def _validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not any(c.isupper() for c in password):
        raise HTTPException(status_code=400, detail="Password needs an uppercase letter")
    if not any(c.islower() for c in password):
        raise HTTPException(status_code=400, detail="Password needs a lowercase letter")
    if not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="Password needs a digit")

def _validate_email(email: str):
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address")



class RegisterReq(BaseModel):
    email: str
    password: str


class LoginReq(BaseModel):
    email: str
    password: str


class UserResp(BaseModel):
    id: str
    email: str
    nickname: str
    token_balance: float
    total_recharged: float
    is_active: bool


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


@router.post("/register")
def register(req: RegisterReq, request: Request, db: Session = Depends(get_db)):
    _rate_limit("register:" + request.client.host)
    _validate_password(req.password)
    _validate_email(req.email)
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        password_hash=pwd.hash(req.password),
        nickname=req.email.split("@")[0],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    return {"token": token, "user_id": user.id}


@router.post("/login")
def login(req: LoginReq, request: Request, db: Session = Depends(get_db)):
    _rate_limit("login:" + request.client.host)
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not pwd.verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user.id)
    return {"token": token, "user_id": user.id}


@router.get("/me", response_model=UserResp)
def get_me(user: User = Depends(get_current_user)):
    return UserResp(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        token_balance=user.token_balance,
        total_recharged=user.total_recharged,
        is_active=user.is_active,
    )
