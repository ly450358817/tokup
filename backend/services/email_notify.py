"""
低余额主动邮件提醒服务（2026-09-01 新增）

设计原则：
1. 默认禁用 —— 未配置 SMTP 时所有函数静默返回，对现有 API 零影响。
2. 异步发送 —— 用 daemon 线程发信，绝不阻塞 API 主流程。
3. 每用户节流 —— 同一用户 24h 内最多发一封，避免刷屏。
4. 失败静默 —— 任何异常只记日志，不影响调用结果。

配置（环境变量，未配置即禁用）：
  SMTP_HOST            如 smtp.qq.com
  SMTP_PORT            如 465（SSL）或 587（STARTTLS）
  SMTP_USER            发件邮箱账号
  SMTP_PASS            授权码（QQ 邮箱为 16 位授权码，非登录密码）
  SMTP_FROM            发件人显示（默认 = SMTP_USER）
  BALANCE_ALERT_THRESHOLD  余额提醒阈值（token，默认 200）
  BALANCE_ALERT_INTERVAL   同一用户两次提醒最小间隔秒数（默认 86400 = 24h）
"""
import logging
import os
import smtplib
import threading
import time
from email.header import Header
from email.mime.text import MIMEText
from email.utils import formataddr

logger = logging.getLogger("tokup.email_notify")

# 进程内节流表：user_id -> 上次发送时间戳（多 worker 下各进程独立，可接受）
_last_sent: dict = {}
_lock = threading.Lock()


def _env(key: str, default: str = "") -> str:
    v = os.getenv(key, "") or ""
    return v.strip().strip('"').strip("'") or default


def is_enabled() -> bool:
    """SMTP 配置齐全才算启用；否则完全静默。"""
    return bool(_env("SMTP_HOST") and _env("SMTP_USER") and _env("SMTP_PASS"))


def alert_threshold() -> float:
    try:
        return max(0.0, float(_env("BALANCE_ALERT_THRESHOLD", "200")))
    except ValueError:
        return 200.0


def alert_interval() -> float:
    try:
        return max(60.0, float(_env("BALANCE_ALERT_INTERVAL", "86400")))
    except ValueError:
        return 86400.0


def _send_sync(to_email: str, subject: str, body: str) -> bool:
    """同步发送（内部用）；任何异常返回 False，只记日志。"""
    host, port = _env("SMTP_HOST"), int(_env("SMTP_PORT", "465") or 465)
    user, pw = _env("SMTP_USER"), _env("SMTP_PASS")
    from_addr = _env("SMTP_FROM") or user
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = formataddr((str(Header("TokUp 平台", "utf-8")), from_addr))
    msg["To"] = to_email
    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.starttls()
        try:
            server.login(user, pw)
            server.sendmail(from_addr, [to_email], msg.as_string())
        finally:
            try:
                server.quit()
            except Exception:
                pass
        return True
    except Exception as e:
        logger.warning("低余额邮件发送失败 to=%s err=%s", to_email, e)
        return False


def maybe_alert_low_balance(user, balance: float) -> None:
    """调用结算后调用：余额低于阈值且未超节流 → 异步发提醒邮件。
    未启用 SMTP / 无邮箱 / 余额足够 / 节流内 → 全部静默跳过。"""
    if not is_enabled():
        return
    if balance is None or balance > alert_threshold():
        return
    try:
        uid = getattr(user, "id", None) or ""
        email = getattr(user, "email", "") or ""
    except Exception:
        return
    if not uid or not email:
        return
    now = time.time()
    with _lock:
        if now - _last_sent.get(uid, 0.0) < alert_interval():
            return
        _last_sent[uid] = now  # 先占位再异步发送，避免并发重发
    subject = "【TokUp】余额不足提醒"
    body = (
        f"您好，\n\n"
        f"您的 TokUp 账户余额已不足 {alert_threshold():.0f} Token"
        f"（当前余额 {balance:.0f} Token）。\n\n"
        f"为避免影响正常使用，请及时充值：\nhttps://tokup.net\n\n"
        f"—— TokUp 平台"
    )
    threading.Thread(target=_send_sync, args=(email, subject, body), daemon=True).start()
