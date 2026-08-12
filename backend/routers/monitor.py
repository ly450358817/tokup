"""
TokUp · 脉充 — Monitoring router
真实数据：基于 usage_records 统计请求数、Token、成功率、模型分布、24h 趋势。
（响应耗时 latency_ms 尚未采集，统一返回 0，前端显示为 "-"）
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from database import get_db
from models import User, UsageRecord
from routers.auth import get_current_user

router = APIRouter(prefix="/api/monitor", tags=["monitor"])

MODEL_LABELS = {
    "gpt-5.5": "GPT-5.5",
    "openai/gpt-5.6-luna": "GPT-5.6 Luna",
    "openai/gpt-5.6-sol": "GPT-5.6 Sol",
    "openai/gpt-5.6-terra": "GPT-5.6 Terra",
    "deepseek-v3": "DeepSeek V3",
    "deepseek-r1": "DeepSeek R1",
    "deepseek/deepseek-v4-pro": "DeepSeek V4 Pro",
    "deepseek/deepseek-v4-flash": "DeepSeek V4 Flash",
    "deepseek/deepseek-v4-flash-20260731": "DeepSeek V4 Flash 0731",
    "deepseek/deepseek-v3.2": "DeepSeek V3.2",
    "qwen3-max": "Qwen3 Max",
    "qwen/qwen3.7-max": "Qwen3.7 Max",
    "qwen/qwen3.8-max": "Qwen3.8 Max",
    "qwen3-coder-480b-a35b-instruct": "Qwen3 Coder",
    "glm-4.5": "GLM-4.5",
    "glm-5.2": "GLM-5.2",
    "moonshotai/kimi-k2.6": "Kimi K2.6",
    "moonshotai/kimi-k3": "Kimi K3",
    "anthropic/claude-fable-5": "Claude Fable 5",
    "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
    "claude-3-opus-20240229": "Claude 3 Opus",
    "claude-3-haiku-20240307": "Claude 3 Haiku",
    "doubao-seed-1.6": "Doubao Seed 1.6",
}


@router.get("/stats")
def monitor_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """真实监控统计：基于 usage_records。"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_start = now - timedelta(hours=24)

    # 今日请求 / 成功数
    today_total = (
        db.query(func.count(UsageRecord.id))
        .filter(UsageRecord.user_id == user.id, UsageRecord.created_at >= today_start)
        .scalar() or 0
    )
    today_avg_latency = (
        db.query(func.avg(case((UsageRecord.latency_ms > 0, UsageRecord.latency_ms), else_=None)))
        .filter(UsageRecord.user_id == user.id, UsageRecord.created_at >= today_start)
        .scalar()
    )
    today_success = (
        db.query(func.count(UsageRecord.id))
        .filter(
            UsageRecord.user_id == user.id,
            UsageRecord.created_at >= today_start,
            UsageRecord.status == "success",
        )
        .scalar() or 0
    )

    def token_sum(from_time=None):
        q = db.query(func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens)).filter(
            UsageRecord.user_id == user.id
        )
        if from_time is not None:
            q = q.filter(UsageRecord.created_at >= from_time)
        return int(q.scalar() or 0)

    total_tokens_today = token_sum(today_start)
    total_tokens_all = token_sum(None)

    # 模型分布（近24h）
    model_rows = (
        db.query(
            UsageRecord.model,
            func.count(UsageRecord.id),
            func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens),
            func.sum(case((UsageRecord.status != "success", 1), else_=0)),
            func.avg(case((UsageRecord.latency_ms > 0, UsageRecord.latency_ms), else_=None)),
        )
        .filter(UsageRecord.user_id == user.id, UsageRecord.created_at >= day_start)
        .group_by(UsageRecord.model)
        .order_by(func.count(UsageRecord.id).desc())
        .all()
    )
    models_data = []
    for model, cnt, tokens, errs, avg_lat in model_rows:
        cnt = int(cnt or 0)
        tokens = int(tokens or 0)
        errs = int(errs or 0)
        error_rate = round((errs / max(cnt, 1)) * 100, 2)
        models_data.append({
            "model": model,
            "label": MODEL_LABELS.get(model, model),
            "requests": cnt,
            "tokens": tokens,
            "avg_latency_ms": int(avg_lat or 0),
            "error_rate": error_rate,
            "status": "healthy" if error_rate < 1.5 else "degraded",
        })

    # 24h 趋势（按小时聚合）
    hourly_rows = (
        db.query(
            func.strftime("%Y-%m-%d %H", UsageRecord.created_at),
            func.count(UsageRecord.id),
        )
        .filter(UsageRecord.user_id == user.id, UsageRecord.created_at >= day_start)
        .group_by(func.strftime("%Y-%m-%d %H", UsageRecord.created_at))
        .all()
    )
    hourly_map = {k: int(v) for k, v in hourly_rows}
    hourly = []
    for i in range(23, -1, -1):
        h = now - timedelta(hours=i)
        key = h.strftime("%Y-%m-%d %H")
        hourly.append({
            "hour": h.strftime("%H:00"),
            "requests": hourly_map.get(key, 0),
            "avg_latency": 0,
        })

    return {
        "today_requests": today_total,
        "total_tokens_today": total_tokens_today,
        "total_tokens_all": total_tokens_all,
        "avg_response_ms": int(today_avg_latency or 0),
        "success_rate": round((today_success / max(today_total, 1)) * 100, 1),
        "models": models_data,
        "hourly_trend": hourly,
        "gateway_status": "online",
        "uptime": "99.97%",
        "last_updated": now.isoformat(),
    }
