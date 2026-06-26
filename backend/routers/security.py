"""
TokUp · 脉充 — AI Security Dashboard Router
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from services.security_service import ip_tracker, security_info, ALL_PATTERNS, SECURITY_LEVEL

router = APIRouter(prefix="/api/security", tags=["Security"])


@router.get("/status")
def security_status():
    """Get security shield status and stats."""
    return {
        "shield": security_info,
        "stats": ip_tracker.get_stats(),
    }


@router.get("/logs")
def security_logs(limit: int = 20, ip: Optional[str] = None):
    """Get suspicious request logs (admin only in production)."""
    logs = ip_tracker.get_suspicious_log(limit)
    if ip:
        logs = [l for l in logs if l.get("ip") == ip]
    return {"logs": logs, "total": len(logs)}


@router.get("/patterns")
def security_patterns():
    """Get active detection patterns (counts only, not regex themselves in production)."""
    return {
        "categories": {k: len(v) for k, v in ALL_PATTERNS.items()},
        "level": SECURITY_LEVEL,
    }
