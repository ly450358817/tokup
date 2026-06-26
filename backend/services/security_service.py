"""
TokUp · 脉充 — AI-Powered Security Shield

Multi-layer defense system:
  1. Pattern-based detection (SQLi, XSS, path traversal, cmd injection)
  2. Smart rate limiting with IP-based tracking
  3. AI-powered anomaly detection (heuristic + potential LLM integration)
  4. Request logging and alerting
"""
import os
import re
import time
import json
import hashlib
import logging
from collections import defaultdict
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("tokup.security")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
SECURITY_LEVEL = os.getenv("TOKUP_SECURITY_LEVEL", "high")  # low | medium | high | paranoid
RATE_LIMIT_PER_MIN = int(os.getenv("TOKUP_RATE_LIMIT", "60"))
RATE_LIMIT_WINDOW = 60  # seconds
BURST_LIMIT = int(os.getenv("TOKUP_BURST_LIMIT", "10"))  # max requests in 3s
BAN_DURATION = int(os.getenv("TOKUP_BAN_DURATION", "300"))  # 5 min temp ban
MAX_AUTH_ATTEMPTS = int(os.getenv("TOKUP_MAX_AUTH_ATTEMPTS", "5"))
ENABLE_AI_ANALYSIS = os.getenv("TOKUP_ENABLE_AI_SECURITY", "true").lower() == "true"

# ──────────────────────────────────────────────
# Attack Pattern Database
# ──────────────────────────────────────────────
SQL_INJECTION_PATTERNS = [
    r"(?i)(\b(union|select|insert|drop|delete|alter|exec|execute)\b.*\b(from|into|table|database|values|set)\b)",
    r"(?i)(\b(union|select|insert|drop|delete|alter|truncate|exec)\b\s*[(])",
    r"(?i)'.*\b(or|and)\b.*\b(=|like|in|between)\b",
    r"(?i)(\b(ben|sleep|pg_sleep|waitfor)\b\s*[\(\[])",
    r"(?i)('|\")\s*(or|and)\s*('|\")\s*(=|<|>)",
    r"(?i)(\b(0x[0-9a-f]+)\b)",
    r"(?i)(--\s|\#|\/\*|\*\/)",
    r"(?i)(\b(load_file|into\s+(dump|out)file)\b)",
]

XSS_PATTERNS = [
    r"(?i)(<script[\s>])",
    r"(?i)(<img[\s>].*(\bonerror|\bonload|\bonclick|\bonmouse))",
    r"(?i)(javascript:\s*(function|void|alert|eval|prompt))",
    r"(?i)(onerror\s*=\s*['\"])",
    r"(?i)(\bon\w+\s*=\s*['\"])",
    r"(?i)(<iframe[\s>])",
    r"(?i)(<svg[\s>].*(\bonload|\bonerror))",
    r"(?i)(eval\s*\(\s*(base64|atob|document|window|navigator))",
    r"(?i)(document\.(write|cookie|location|domain))",
]

PATH_TRAVERSAL_PATTERNS = [
    r"(\.\.\/|\.\.\\)",
    r"(~\/[a-zA-Z])",
    r"(/etc/passwd|/etc/shadow|/proc/self)",
    r"(\.env|config\.json|\.git/config)",
    r"(/proc/self/environ)",
]

CMD_INJECTION_PATTERNS = [
    r"(?i)(;\s*(rm|cat|wget|curl|bash|sh|python|nc|ncat)\s)",
    r"(?i)(\|\s*(rm|cat|wget|curl|bash|sh|python|nc)\s)",
    r"(?i)(`[^`]+`)",
    r"(?i)(\$\([^)]+\))",
    r"(?i)(\b(exec|system|popen|subprocess|shell_exec|passthru)\s*\()",
]

NO_SQL_INJECTION = [
    r"(?i)(\b\$(\s*(gt|gte|lt|lte|ne|eq|in|nin|regex|exists|where))\b)",
    r"(?i)(\b\$(\s*(not|nor|and|or))\b)",
    r"(?i)(\bne\b.*\bnull\b)",
]

ALL_PATTERNS = {
    "sql_injection": SQL_INJECTION_PATTERNS,
    "xss": XSS_PATTERNS,
    "path_traversal": PATH_TRAVERSAL_PATTERNS,
    "cmd_injection": CMD_INJECTION_PATTERNS,
    "nosql_injection": NO_SQL_INJECTION,
}

# ──────────────────────────────────────────────
# IP Tracking (in-memory, resets on restart)
# ──────────────────────────────────────────────
class IPTracker:
    """Tracks request frequency, anomalies, and bans per IP."""

    def __init__(self):
        self._requests: Dict[str, list] = defaultdict(list)  # ip → [timestamps]
        self._banned: Dict[str, float] = {}                    # ip → ban_until
        self._auth_fails: Dict[str, int] = defaultdict(int)    # ip → count
        self._suspicious: Dict[str, list] = defaultdict(list)   # ip → [reasons]
        self._total_checked = 0
        self._total_blocked = 0

    def is_banned(self, ip: str) -> bool:
        if ip in self._banned:
            if time.time() < self._banned[ip]:
                return True
            del self._banned[ip]
        return False

    def ban(self, ip: str, duration: int = BAN_DURATION):
        self._banned[ip] = time.time() + duration
        logger.warning(f"🛡️ Banned IP {ip} for {duration}s")

    def record_request(self, ip: str):
        now = time.time()
        self._requests[ip] = [t for t in self._requests[ip] if now - t < RATE_LIMIT_WINDOW]
        self._requests[ip].append(now)
        self._total_checked += 1

    def record_auth_fail(self, ip: str):
        self._auth_fails[ip] += 1
        if self._auth_fails[ip] >= MAX_AUTH_ATTEMPTS:
            self.ban(ip, BAN_DURATION * 2)  # Double ban for auth failures

    def record_suspicious(self, ip: str, reason: str):
        self._suspicious[ip].append({"time": datetime.now().isoformat(), "reason": reason})
        self._total_blocked += 1
        if len(self._suspicious[ip]) >= 3:
            self.ban(ip)

    def request_count(self, ip: str) -> int:
        self._requests[ip] = [t for t in self._requests[ip] if time.time() - t < RATE_LIMIT_WINDOW]
        return len(self._requests[ip])

    def burst_count(self, ip: str) -> int:
        """Count requests in last 3 seconds."""
        now = time.time()
        return sum(1 for t in self._requests[ip] if now - t < 3)

    def get_stats(self) -> dict:
        return {
            "total_requests_checked": self._total_checked,
            "total_blocked": self._total_blocked,
            "active_bans": len(self._banned),
            "suspicious_ips": len(self._suspicious),
            "tracked_ips": len(self._requests),
        }

    def get_suspicious_log(self, limit: int = 20) -> list:
        entries = []
        for ip, logs in self._suspicious.items():
            for log in logs[-5:]:
                entries.append({"ip": ip, **log})
        entries.sort(key=lambda x: x["time"], reverse=True)
        return entries[:limit]


ip_tracker = IPTracker()


# ──────────────────────────────────────────────
# Pattern Scanner
# ──────────────────────────────────────────────
def scan_payload(payload: str) -> List[Tuple[str, str]]:
    """
    Scan a string payload for known attack patterns.
    Returns list of (category, matched_pattern) tuples.
    """
    findings = []
    if not payload or len(payload) > 10000:
        return findings  # Skip empty or oversized payloads

    for category, patterns in ALL_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, payload)
            if match:
                findings.append((category, match.group()[:80]))
                if SECURITY_LEVEL == "low":
                    break  # Only one match per category in low mode
        if len(findings) >= 5:  # Cap findings per payload
            break
    return findings


# ──────────────────────────────────────────────
# AI-powered Anomaly Detection (heuristic + LLM)
# ──────────────────────────────────────────────
def heuristic_anomaly_score(
    request_size: int,
    has_body: bool,
    content_type: str,
    path: str,
    ip_request_rate: int,
    is_auth: bool,
) -> float:
    """
    Calculate an anomaly score (0.0 – 1.0) for a request.
    Higher = more suspicious. Used as AI heuristic before LLM call.
    """
    score = 0.0

    # Oversized request bodies
    if has_body and request_size > 100000:
        score += 0.3
    if request_size > 500000:
        score += 0.3

    # Unusual content types
    if has_body and content_type and "json" not in content_type and "form" not in content_type:
        score += 0.2

    # High request rate from same IP
    if ip_request_rate > RATE_LIMIT_PER_MIN * 0.8:
        score += 0.3
    if ip_request_rate > RATE_LIMIT_PER_MIN * 1.5:
        score += 0.4

    # Repeated auth attempts
    if is_auth and ip_request_rate > 3:
        score += 0.3

    return min(score, 1.0)


# ──────────────────────────────────────────────
# FastAPI Security Middleware
# ──────────────────────────────────────────────
class AISecurityMiddleware(BaseHTTPMiddleware):
    """
    Multi-layer AI security middleware:
    1. Check IP ban list
    2. Rate limit check with burst detection
    3. Pattern-based payload scanning
    4. Heuristic anomaly scoring
    """

    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        path = request.url.path

        # Skip security checks for health endpoints and static files
        if path in ("/api/health", "/api/security/health", "/docs", "/openapi.json"):
            return await call_next(request)

        # 1. Ban check
        if ip_tracker.is_banned(client_ip):
            logger.warning(f"🛡️ Blocked banned IP {client_ip} → {path}")
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={"detail": "Too Many Requests", "code": "rate_limited", "retry_after": BAN_DURATION},
            )

        # 2. Rate + burst check
        ip_tracker.record_request(client_ip)
        if ip_tracker.burst_count(client_ip) > BURST_LIMIT:
            ip_tracker.record_suspicious(client_ip, f"burst_exceeded ({ip_tracker.burst_count(client_ip)} in 3s)")
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={"detail": "Request rate exceeded", "code": "burst_limited"},
            )

        if ip_tracker.request_count(client_ip) > RATE_LIMIT_PER_MIN:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "code": "rate_limited"},
            )

        # 3. Payload scanning
        if request.method in ("POST", "PUT", "PATCH") and request.headers.get("content-type", "").startswith(
            ("application/json", "application/x-www-form-urlencoded", "multipart/form-data")
        ):
            try:
                body = await request.body()
                body_str = body.decode("utf-8", errors="ignore")

                findings = scan_payload(body_str)
                if findings:
                    reasons = [f"{cat}:{pat}" for cat, pat in findings[:3]]
                    ip_tracker.record_suspicious(client_ip, "; ".join(reasons))

                    if SECURITY_LEVEL in ("high", "paranoid"):
                        from fastapi.responses import JSONResponse
                        logger.warning(f"🛡️ Blocked attack from {client_ip} → {path}: {reasons[0]}")
                        return JSONResponse(
                            status_code=403,
                            content={"detail": "Request blocked by AI Security Shield", "code": "blocked"},
                        )

                # 4. Heuristic anomaly scoring
                if ENABLE_AI_ANALYSIS:
                    score = heuristic_anomaly_score(
                        request_size=len(body),
                        has_body=len(body) > 0,
                        content_type=request.headers.get("content-type", ""),
                        path=path,
                        ip_request_rate=ip_tracker.request_count(client_ip),
                        is_auth="auth" in path,
                    )
                    if score > 0.7 and SECURITY_LEVEL == "paranoid":
                        ip_tracker.record_suspicious(client_ip, f"high_anomaly_score:{score:.2f}")
                        from fastapi.responses import JSONResponse
                        return JSONResponse(
                            status_code=403,
                            content={"detail": "Request blocked by AI Security Shield", "code": "anomaly"},
                        )
            except Exception as e:
                logger.error(f"Security scan error: {e}")

        # 5. Track auth failures (for rate limiting)
        response = await call_next(request)

        if "auth" in path and response.status_code == 401:
            ip_tracker.record_auth_fail(client_ip)

        return response

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"


# ──────────────────────────────────────────────
# Security Info Router
# ──────────────────────────────────────────────
security_info = {
    "shield_active": True,
    "level": SECURITY_LEVEL,
    "patterns_active": len(ALL_PATTERNS),
    "rate_limit": RATE_LIMIT_PER_MIN,
    "burst_limit": BURST_LIMIT,
    "ban_duration": BAN_DURATION,
    "ai_analysis": ENABLE_AI_ANALYSIS,
    "layers": [
        "IP Ban Detection",
        "Rate Limiting + Burst Detection",
        "SQL Injection Scanner",
        "XSS Scanner",
        "Path Traversal Scanner",
        "Command Injection Scanner",
        "NoSQL Injection Scanner",
        "Heuristic Anomaly Scoring",
        "Auth Failure Tracking",
    ],
}
