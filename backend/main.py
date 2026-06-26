"""
TokUp · 脉充 — Backend API
"""
import os
import secrets
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from database import engine, Base, SessionLocal
from models import User
from routers import auth, dashboard, payment, keys, api_proxy, security, monitor, settings, ws as ws_router
from services.security_service import AISecurityMiddleware, ip_tracker

# ── 环境配置 ──
SECRET_KEY = os.getenv("TOKUP_SECRET_KEY", secrets.token_hex(32))
ALLOWED_ORIGINS = os.getenv("TOKUP_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
ALLOWED_HOSTS = os.getenv("TOKUP_ALLOWED_HOSTS", "localhost,tokup.io,api.tokup.io").split(",")
ADMIN_EMAIL = os.getenv("TOKUP_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("TOKUP_ADMIN_PASSWORD", "")

# 建表
Base.metadata.create_all(bind=engine)

# 创建默认管理员（仅当配置了管理员账号时）
if ADMIN_EMAIL and ADMIN_PASSWORD:
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.is_admin == True).first():
            from passlib.context import CryptContext
            pwd = CryptContext(schemes=["bcrypt"])
            admin = User(
                email=ADMIN_EMAIL,
                password_hash=pwd.hash(ADMIN_PASSWORD),
                nickname="Admin",
                token_balance=999999,
                is_admin=True,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()

app = FastAPI(title="TokUp API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=ALLOWED_HOSTS,
)

# ── AI Security Shield ──
app.add_middleware(AISecurityMiddleware)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(payment.router)
app.include_router(keys.router)
app.include_router(api_proxy.router)
app.include_router(security.router)
app.include_router(monitor.router)
app.include_router(settings.router)
app.include_router(ws_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.2.0", "name": "TokUp"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
