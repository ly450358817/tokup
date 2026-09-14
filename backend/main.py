"""
TokUp · 脉充 — Backend API
"""
import os
import secrets
import sentry_sdk
from dotenv import load_dotenv
import asyncio
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from database import engine, Base, SessionLocal
from models import User
from routers import auth, dashboard, payment, keys, api_proxy, security, monitor, settings, admin, usage, invite, subscription, analytics, support, ws as ws_router
from services.security_service import AISecurityMiddleware, ip_tracker

# ── 加载 .env 文件 ──
load_dotenv()

# ── 环境配置 ──
SECRET_KEY = os.getenv("TOKUP_SECRET_KEY", secrets.token_hex(32))
ALLOWED_ORIGINS = os.getenv("TOKUP_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
ALLOWED_HOSTS = os.getenv("TOKUP_ALLOWED_HOSTS", "localhost,tokup.io,api.tokup.io").split(",")
ADMIN_EMAIL = os.getenv("TOKUP_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.getenv("TOKUP_ADMIN_PASSWORD", "")
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
SENTRY_ENVIRONMENT = os.getenv("SENTRY_ENVIRONMENT", "production")
SENTRY_RELEASE = os.getenv("SENTRY_RELEASE", "").strip()

try:
    SENTRY_TRACES_SAMPLE_RATE = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
except ValueError:
    SENTRY_TRACES_SAMPLE_RATE = 0.1

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        release=SENTRY_RELEASE or None,
        traces_sample_rate=max(0.0, min(SENTRY_TRACES_SAMPLE_RATE, 1.0)),
        send_default_pii=False,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
        ],
    )

# 建表（多 worker 并发启动时可能撞"已存在"，忽略即可）
try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

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
app.include_router(support.router)


@app.on_event("startup")
async def _startup_tasks():
    """启动后台任务：支付对账 + 对话存档定期清理（幂等，多 worker 安全）"""
    from routers.payment import payment_reconcile_loop
    asyncio.create_task(payment_reconcile_loop())
    asyncio.create_task(_cleanup_conversation_logs())
    asyncio.create_task(_subscription_reminder_loop())


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

async def _subscription_reminder_loop():
    """订阅到期/刚到期邮件提醒（2026-09-14 新增）。

    - 每小时检查一次；对「24 小时内到期」和「24 小时内刚过期」的订阅各发一封提醒邮件。
    - 用文件状态去重（同一订阅同一类型只发一次）+ flock 防多 worker 重复执行。
    - 未配置 SMTP 时完全静默。
    """
    import json
    import logging
    import os
    from datetime import datetime, timedelta, timezone as _tz
    log = logging.getLogger("tokup.log")
    base = os.path.dirname(os.path.abspath(__file__))
    state_path = os.path.join(base, ".sub_reminder_state.json")
    lock_path = os.path.join(base, ".sub_reminder.lock")
    while True:
        lock_fd = None
        try:
            import fcntl
            lock_fd = open(lock_path, "w")
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                lock_fd.close()
                lock_fd = None
                await asyncio.sleep(3600)
                continue
            from services.email_notify import is_enabled, send_email
            if is_enabled():
                state = {}
                try:
                    if os.path.exists(state_path):
                        with open(state_path, encoding="utf-8") as f:
                            state = json.load(f)
                except Exception:
                    state = {}
                from database import SessionLocal
                from models import Subscription, User
                now = datetime.now(_tz.utc)
                db = SessionLocal()
                changed = False
                try:
                    soon = (
                        db.query(Subscription)
                        .filter(
                            Subscription.is_active == True,
                            Subscription.end_date > now,
                            Subscription.end_date <= now + timedelta(hours=24),
                        )
                        .all()
                    )
                    just_expired = (
                        db.query(Subscription)
                        .filter(
                            Subscription.is_active == True,
                            Subscription.end_date <= now,
                            Subscription.end_date >= now - timedelta(hours=24),
                        )
                        .all()
                    )
                    def _send(sub, kind):
                        nonlocal changed
                        key = "%s:%s" % (sub.id, kind)
                        if state.get(key):
                            return
                        u = db.query(User).filter(User.id == sub.user_id).first()
                        if not u or not u.email:
                            return
                        if kind == "expiring":
                            subject = "【TokUp】你的订阅即将到期"
                            body = (
                                "您好，\n\n"
                                "您的 TokUp 订阅将于 24 小时内到期。\n"
                                "到期后每日免费额度将停止，超额调用会按余额计费。\n\n"
                                "续费后可继续享受每日免费额度 + 全模型余额消费 9 折：\n"
                                "https://tokup.net/pricing\n\n"
                                "—— TokUp 平台"
                            )
                        else:
                            subject = "【TokUp】你的订阅已到期"
                            body = (
                                "您好，\n\n"
                                "您的 TokUp 订阅已到期，每日免费额度已停止。\n\n"
                                "续费 ¥29.9 体验订阅即可继续享受：\n"
                                "· 每天 5 万 Token 免费额度\n"
                                "· 全模型余额消费 9 折\n"
                                "https://tokup.net/pricing\n\n"
                                "—— TokUp 平台"
                            )
                        if send_email(u.email, subject, body):
                            state[key] = now.isoformat()
                            changed = True
                    for sub in soon:
                        _send(sub, "expiring")
                    for sub in just_expired:
                        _send(sub, "expired")
                    if changed:
                        tmp = state_path + ".tmp"
                        with open(tmp, "w", encoding="utf-8") as f:
                            json.dump(state, f, ensure_ascii=False)
                        os.replace(tmp, state_path)
                finally:
                    db.close()
        except Exception:
            log.warning("订阅提醒循环异常（忽略）", exc_info=True)
        finally:
            if lock_fd is not None:
                try:
                    lock_fd.close()
                except Exception:
                    pass
        await asyncio.sleep(3600)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.2.0", "name": "TokUp"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
