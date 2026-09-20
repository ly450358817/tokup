"""TokUp 安全告警推送（仅通知，不改变业务行为）。"""
import logging
import os
import threading
import time

logger = logging.getLogger("tokup.alert_notify")
_lock = threading.Lock()
_last_sent: dict[str, float] = {}


def _channels() -> dict:
    ch = {k: os.getenv(k, "") for k in ("WECOM_WEBHOOK", "PUSHPLUS_TOKEN", "SENDKEY")}
    cfg = os.getenv("ALERT_CONFIG", "/opt/tokup/scripts/alert-config.env")
    try:
        if os.path.exists(cfg):
            for line in open(cfg, encoding="utf-8"):
                line = line.strip()
                if line and "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    if k in ch and not ch[k]:
                        ch[k] = v.strip().strip('"').strip("'")
    except Exception:
        pass
    return ch


def _send(title: str, content: str) -> None:
    import httpx
    ch = _channels()
    try:
        if ch.get("WECOM_WEBHOOK"):
            httpx.post(ch["WECOM_WEBHOOK"], json={"msgtype": "text", "text": {"content": f"{title}\n{content}"}}, timeout=10)
        if ch.get("PUSHPLUS_TOKEN"):
            httpx.post("https://www.pushplus.plus/send", json={"token": ch["PUSHPLUS_TOKEN"], "title": title, "content": content}, timeout=10)
        if ch.get("SENDKEY"):
            httpx.post(f"https://sctapi.ftqq.com/{ch['SENDKEY']}.send", data={"title": title, "desp": content}, timeout=10)
    except Exception as e:
        logger.warning("安全告警推送失败: %s", e)


def push_alert_async(title: str, content: str, dedup_key: str = "", cooldown: int = 300) -> None:
    """异步推送；同一 dedup_key 默认 5 分钟内只发一次。未配置渠道时静默。"""
    key = dedup_key or title
    now = time.time()
    with _lock:
        if now - _last_sent.get(key, 0.0) < max(0, int(cooldown)):
            return
        _last_sent[key] = now
    threading.Thread(target=_send, args=(title, content), daemon=True).start()
