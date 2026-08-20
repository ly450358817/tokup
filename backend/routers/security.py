"""
TokUp · 脉充 — AI Security Dashboard Router
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from services.security_service import ip_tracker, security_info, ALL_PATTERNS, SECURITY_LEVEL
from routers.auth import get_current_user
from models import User

router = APIRouter(prefix="/api/security", tags=["Security"])


@router.get("/status")
def security_status(user: User = Depends(get_current_user)):
    """Get security shield status and stats (需登录)."""
    return {
        "shield": security_info,
        "stats": ip_tracker.get_stats(),
    }


@router.get("/logs")
def security_logs(user: User = Depends(get_current_user), limit: int = 20, ip: Optional[str] = None):
    """Get suspicious request logs (admin only)."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    logs = ip_tracker.get_suspicious_log(limit)
    if ip:
        logs = [l for l in logs if l.get("ip") == ip]
    return {"logs": logs, "total": len(logs)}


@router.get("/patterns")
def security_patterns(user: User = Depends(get_current_user)):
    """Get active detection patterns (需登录)."""
    return {
        "categories": {k: len(v) for k, v in ALL_PATTERNS.items()},
        "level": SECURITY_LEVEL,
    }
