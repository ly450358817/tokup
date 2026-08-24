"""
TokUp · 脉充 — Backend API
"""
import os
import secrets
from dotenv import load_dotenv
import asyncio
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from database import engine, Base, SessionLocal
from models import User
from routers import auth, dashboard, payment, keys, api_proxy, security, monitor, settings, admin, usage, invite, subscription, analytics, ws as ws_router
from services.security_service import AISecurityMiddleware, ip_tracker

# ── 加载 .env 文件 ──
load_dotenv()

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

@app.exception_handler(HTTPException)
async def _http_exc_handler(request: Request, exc: HTTPException):
    """402 统一返回 OpenAI 兼容 error 格式，openai SDK 能正确解析 message（否则报 402 status code (no body)）"""
    if exc.status_code == 402:
        return JSONResponse(
            status_code=402,
            content={
                "error": {
                    "message": str(exc.detail),
                    "type": "insufficient_balance",
                    "param": None,
                    "code": 402,
                }
            },
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )

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
app.include_router(admin.router)
app.include_router(usage.router)
app.include_router(invite.router)
app.include_router(subscription.router)
app.include_router(analytics.router)


@app.on_event("startup")
async def _startup_tasks():
    """启动后台任务：支付对账 + 对话存档定期清理（幂等，多 worker 安全）"""
    from routers.payment import payment_reconcile_loop
    asyncio.create_task(payment_reconcile_loop())
    asyncio.create_task(_cleanup_conversation_logs())


@app.on_event("shutdown")
async def _shutdown_close_http():
    """关闭上游 HTTP 连接池（ai_service 共享 AsyncClient）。失败不影响退出。"""
    try:
        from services.ai_service import close_http_client
        await close_http_client()
    except Exception:
        import logging
        logging.getLogger("tokup").warning("关闭 HTTP 连接池失败（忽略）", exc_info=True)


async def _cleanup_conversation_logs():
    """每天清理超过 12 个月的对话存档（与《隐私政策》留存期限一致，控制库增长）"""
    import logging
    from datetime import datetime, timedelta, timezone as _tz
    while True:
        try:
            from database import SessionLocal
            from models import ConversationLog
            db = SessionLocal()
            try:
                cutoff = datetime.now(_tz.utc) - timedelta(days=365)
                n = db.query(ConversationLog).filter(ConversationLog.created_at < cutoff).delete()
                db.commit()
                if n:
                    logging.getLogger("tokup.log").info("清理过期对话存档 %s 条", n)
            finally:
                db.close()
        except Exception:
            pass
        await asyncio.sleep(86400)

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.2.0", "name": "TokUp"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
