from datetime import datetime, timedelta, timezone
import os
import secrets
import uuid
import time
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.alert_notify import push_alert_async

from database import get_db
from models import User, Transaction

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd = CryptContext(schemes=["bcrypt"])
security = HTTPBearer()

SECRET_KEY = os.getenv("TOKUP_SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"

# ── Cloudflare Turnstile 人机验证 ──
TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY", "")
TURNSTILE_ENABLED = os.getenv("TURNSTILE_ENABLED", "true").lower() == "true"


def _verify_turnstile(token: str) -> bool:
    if not TURNSTILE_SECRET_KEY:
        return True  # 未配置则跳过
    if not token:
        return False
    try:
        import httpx
        r = httpx.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": TURNSTILE_SECRET_KEY, "response": token},
            timeout=10,
        )
        return r.json().get("success") is True
    except Exception:
        return False

# --- Rate limiter (in-memory, per IP) ---
_rate_limit_store: dict = {}

def _rate_limit(key: str, max_attempts: int = 200, window: int = 60):
    now = time.time()
    timestamps = _rate_limit_store.get(key, [])
    timestamps = [t for t in timestamps if now - t < window]
    if len(timestamps) >= max_attempts:
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")
    timestamps.append(now)
    _rate_limit_store[key] = timestamps

AUTH_FAIL_LIMIT = int(os.getenv("TOKUP_AUTH_FAIL_LIMIT", "5"))
AUTH_FAIL_WINDOW = int(os.getenv("TOKUP_AUTH_FAIL_WINDOW", "900"))  # 15 分钟


def _check_auth_lockout(key: str):
    fails = [t for t in _rate_limit_store.get("authfail:" + key, []) if time.time() - t < AUTH_FAIL_WINDOW]
    _rate_limit_store["authfail:" + key] = fails
    if len(fails) >= AUTH_FAIL_LIMIT:
        raise HTTPException(status_code=429, detail="尝试次数过多，请 15 分钟后再试")


def _record_auth_fail(key: str):
    _rate_limit_store.setdefault("authfail:" + key, []).append(time.time())


def _clear_auth_fails(key: str):
    _rate_limit_store.pop("authfail:" + key, None)


def _get_client_ip(request):
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host or "unknown"
    return "unknown"
def _is_automation_login(request) -> bool:
    """判断是否为本机自动化巡检的登录（curl 从服务器自身发起）。
    两个条件必须同时满足，避免弱化安全告警：
      1) 来源 IP 在 ADMIN_LOGIN_ALERT_EXEMPT_IPS 白名单内（默认仅本机 + 生产服务器自身 IP）
      2) User-Agent 是脚本类客户端（curl/wget/python/httpx/go）
    真人浏览器登录（Mozilla UA）或异地 IP 一律照常推送。"""
    # 只信 Cloudflare 写入的 cf-connecting-ip；没有该头（可能绕过 CDN 直连源站并伪造 XFF）
    # 一律不豁免 —— 失败方向是"多推一条告警"，不会漏报。
    cf_ip = (request.headers.get("cf-connecting-ip") or "").strip()
    if not cf_ip:
        return False
    raw = os.getenv("ADMIN_LOGIN_ALERT_EXEMPT_IPS", "127.0.0.1,::1,101.32.189.59")
    exempt = {x.strip() for x in raw.split(",") if x.strip()}
    if cf_ip not in exempt:
        return False
    ua = (request.headers.get("user-agent") or "").lower()
    return any(k in ua for k in (
        "curl", "wget", "python-requests", "python-urllib", "httpx", "go-http-client",
    ))


def _validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="密码至少需要 8 位")

def _validate_email(email: str):
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="邮箱格式不正确")



class RegisterReq(BaseModel):
    email: str
    password: str
    invite_code: str = ""        # 可选邀请码
    website: str = ""            # 蜜罐：正常用户不会填
    form_started_at: float = 0   # 前端记录的表单开始时间（秒）
    turnstile_token: str = ""    # Cloudflare Turnstile 人机验证令牌


class LoginReq(BaseModel):
    email: str
    password: str


class UserResp(BaseModel):
    is_admin: bool = False
    terms_version: str = ""
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
        raise HTTPException(status_code=401, detail="登录已失效，请重新登录")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="用户不存在或已停用")
    return user


@router.post("/register")
def register(req: RegisterReq, request: Request, db: Session = Depends(get_db)):
    _rate_limit("register:" + _get_client_ip(request))
    # 轻量防刷（零依赖，不影响正常用户）：蜜罐 + 填表耗时检测
    if req.website:
        raise HTTPException(status_code=400, detail="请求无效")
    if req.form_started_at and time.time() - req.form_started_at < 2:
        raise HTTPException(status_code=400, detail="提交太快，请稍后再试")
    # 数据库级限流：该 IP 24 小时内已注册 ≥10 个则拒绝（无条件生效，跨 worker/重启可靠）
    client_ip = _get_client_ip(request)
    _recent = db.query(func.count(User.id)).filter(
        User.ip_address == client_ip,
        User.created_at >= datetime.now(timezone.utc) - timedelta(hours=24),
    ).scalar() or 0
    if _recent >= 10:
        raise HTTPException(status_code=429, detail="注册过于频繁，请稍后再试")
    # Turnstile：配置了密钥才校验；未配置不硬卡真实用户（IP 上限已兜底）
    if req.turnstile_token:
        if TURNSTILE_ENABLED and TURNSTILE_SECRET_KEY and not _verify_turnstile(req.turnstile_token):
            raise HTTPException(status_code=400, detail="人机验证失败，请重试")
    _validate_password(req.password)
    _validate_email(req.email)
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="该邮箱已被注册，请直接登录")
    user = User(
        email=req.email,
        password_hash=pwd.hash(req.password),
        nickname=req.email.split("@")[0],
        token_balance=0,  # 2026-08-20 取消注册体验金：杜绝"充值¥1解锁体验金再用完换号"刷号（花1得2）；新用户充值多少用多少
        invite_code=uuid.uuid4().hex[:8].upper(),
        ip_address=_get_client_ip(request),
        terms_version="v2",  # 新用户注册时已勾选同意 V1.1 协议
    )
    try:
        db.add(user)
        db.flush()  # 获取 user.id
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="该邮箱已被注册，请直接登录")
    
    # 处理邀请奖励（防刷小号：仅累计真实充值 ≥¥50 的邀请人可获奖励；单次 100 token、上限 5 次，
    # 刷号成本(¥50)远超收益(≤¥5)，无利可图；被邀请人注册不再赠送 token）
    if req.invite_code:
        referrer = db.query(User).filter(User.invite_code == req.invite_code).first()
        if referrer and referrer.id != user.id:
            user.referred_by = referrer.id
            if (referrer.total_recharged or 0) >= 50:
                if hasattr(referrer, 'invite_count'):
                    referrer.invite_count = (referrer.invite_count or 0) + 1
                if (referrer.paid_invite_count or 0) < 5:
                    referrer.token_balance += 100
                    referrer.paid_invite_count = (referrer.paid_invite_count or 0) + 1
            # 被邀请人注册不再赠送 token（避免白嫖）
    
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    return {"token": token, "user_id": user.id, "invite_code": user.invite_code}


@router.post("/login")
def login(req: LoginReq, request: Request, db: Session = Depends(get_db)):
    _rate_limit("login:" + _get_client_ip(request))
    _client_ip = _get_client_ip(request)
    _auth_key = f"{req.email}|{_client_ip}"
    _check_auth_lockout(_auth_key)
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not pwd.verify(req.password, user.password_hash):
        _record_auth_fail(_auth_key)
        if user and user.is_admin:
            push_alert_async(
                "TokUp 管理员登录失败",
                f"邮箱: {req.email}\nIP: {_get_client_ip(request)}\nUA: {request.headers.get('user-agent','')[:180]}",
                dedup_key=f"admin-login-fail:{req.email}:{_get_client_ip(request)}",
                cooldown=60,
            )
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    _clear_auth_fails(_auth_key)
    if user.is_admin and not _is_automation_login(request):
        push_alert_async(
            "TokUp 管理员登录成功",
            f"邮箱: {user.email}\nIP: {_get_client_ip(request)}\nUA: {request.headers.get('user-agent','')[:180]}",
            dedup_key=f"admin-login-ok:{user.id}",
            cooldown=60,
        )
    token = create_token(user.id)
    return {"token": token, "user_id": user.id}


@router.get("/me", response_model=UserResp)
def get_me(user: User = Depends(get_current_user)):
    return UserResp(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        token_balance=user.token_balance,
        total_recharged=round(user.total_recharged, 2),
        is_active=user.is_active,
        is_admin=user.is_admin,
        terms_version=user.terms_version or "",
    )


@router.post("/accept-terms")
def accept_terms(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """老用户确认同意 V1.1《用户服务协议》与《隐私政策》，记录版本号便于审计"""
    if user.terms_version != "v2":
        user.terms_version = "v2"
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
    return {"ok": True, "terms_version": user.terms_version}
