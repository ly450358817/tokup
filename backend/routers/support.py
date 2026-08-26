"""
TokUp · 脉充 — 客服工单（用户提交退款/投诉/问题，管理员后台查看回复）
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from database import get_db
from models import SupportTicket, User
from routers.auth import get_current_user

router = APIRouter(prefix="/api/support", tags=["support"])

CATEGORY_LABELS = {"refund": "退款申请", "complaint": "投诉", "question": "功能/使用问题", "other": "其他"}


class TicketCreateReq(BaseModel):
    category: str = "other"
    subject: str = ""
    message: str = ""
    order_id: str = ""


class TicketReplyReq(BaseModel):
    reply: str = ""
    status: str = "processing"


def _notify_channels():
    """读取推送渠道：优先环境变量，其次 /opt/tokup/scripts/alert-config.env（与健康告警同一配置源）"""
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


def _push_notify(title: str, content: str):
    """推送新工单到微信（企微机器人 / PushPlus / Server酱，配了哪个用哪个；未配置静默跳过）"""
    import httpx
    ch = _notify_channels()
    try:
        if ch.get("WECOM_WEBHOOK"):
            httpx.post(ch["WECOM_WEBHOOK"], json={"msgtype": "text", "text": {"content": f"{title}\n{content}"}}, timeout=10)
        if ch.get("PUSHPLUS_TOKEN"):
            httpx.post("https://www.pushplus.plus/send", json={"token": ch["PUSHPLUS_TOKEN"], "title": title, "content": content}, timeout=10)
        if ch.get("SENDKEY"):
            httpx.post(f"https://sctapi.ftqq.com/{ch['SENDKEY']}.send", data={"title": title, "desp": content}, timeout=10)
    except Exception:
        pass


@router.post("/tickets")
def create_ticket(req: TicketCreateReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """用户提交工单（退款申请/投诉/问题）"""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="请填写留言内容")
    cat = req.category if req.category in CATEGORY_LABELS else "other"
    t = SupportTicket(
        user_id=user.id,
        category=cat,
        subject=(req.subject or "").strip()[:100],
        message=req.message.strip()[:5000],
        order_id=(req.order_id or "").strip()[:64],
        status="new",
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    _push_notify(
        "💬 TokUp 新客服工单",
        f"用户: {user.email}\n分类: {CATEGORY_LABELS.get(cat, cat)}\n订单: {t.order_id or '无'}\n留言: {t.message[:200]}",
    )
    return {"success": True, "id": t.id, "status": t.status}


@router.get("/tickets")
def list_tickets(user: User = Depends(get_current_user), db: Session = Depends(get_db), status: str = ""):
    """管理员看全部；普通用户只看自己的"""
    q = db.query(SupportTicket)
    if not user.is_admin:
        q = q.filter(SupportTicket.user_id == user.id)
    if status:
        q = q.filter(SupportTicket.status == status)
    rows = q.order_by(desc(SupportTicket.created_at)).limit(200).all()
    emails = {}
    if user.is_admin:
        ids = {r.user_id for r in rows}
        if ids:
            for u in db.query(User).filter(User.id.in_(ids)).all():
                emails[u.id] = u.email
    return {
        "items": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "email": emails.get(r.user_id, ""),
                "category": r.category,
                "category_label": CATEGORY_LABELS.get(r.category, r.category),
                "subject": r.subject,
                "message": r.message,
                "order_id": r.order_id,
                "status": r.status,
                "admin_reply": r.admin_reply,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


@router.get("/tickets/unread-count")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.is_admin:
        return {"count": 0}
    cnt = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "new").scalar() or 0
    return {"count": cnt}


@router.post("/tickets/{ticket_id}/reply")
def reply_ticket(ticket_id: str, req: TicketReplyReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """管理员回复/更新状态"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    t = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="工单不存在")
    if req.reply.strip():
        t.admin_reply = req.reply.strip()[:5000]
    t.status = req.status if req.status in ("new", "processing", "closed") else "processing"
    db.commit()
    return {"success": True, "status": t.status}
