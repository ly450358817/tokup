"""
TokUp · 脉充 — 模型调用分析 / 分流 路由
基于 usage_records 真实数据：总数、总TOKEN、平均TPM/RPM、总额度、消耗分布时序、模型→上游路由。
只读接口，不修改任何现有逻辑，不影响存量用户。
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import User, UsageRecord
from routers.auth import get_current_user
from services.ai_service import MODEL_ROUTES, MODEL_COST, UPSTREAM_MODEL_NAME, QINIU_ENDPOINT, ZHIPU_ENDPOINT

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

PROVIDER_LABELS = {
    "qiniu": "七牛云",
    "zhipu": "智谱",
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "deepseek": "DeepSeek",
    "": "未知",
}


def _minutes_in_range(days: int) -> int:
    """范围内实际分钟数（用于 TPM/RPM 分母，至少 1 分钟）"""
    return max(1, days * 24 * 60)


def _bucket_format(days: int, dt: datetime) -> str:
    """根据时间范围选择聚合粒度：<=3天按小时，否则按天"""
    if days <= 3:
        return dt.strftime("%m-%d %H:00")
    return dt.strftime("%m-%d")


@router.get("/overview")
def analytics_overview(
    days: int = Query(7, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """模型调用分析：统计卡片 + 消耗分布时序（按模型分色）"""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    records = (
        db.query(UsageRecord)
        .filter(UsageRecord.user_id == user.id, UsageRecord.created_at >= cutoff)
        .all()
    )

    total_calls = len(records)
    total_tokens = sum((r.input_tokens or 0) + (r.output_tokens or 0) for r in records)
    total_cost = round(sum(r.cost_cny or 0 for r in records), 4)
    minutes = _minutes_in_range(days)
    avg_tpm = round(total_tokens / minutes, 1)
    avg_rpm = round(total_calls / minutes, 2)

    # 按模型聚合
    model_stats = {}
    for r in records:
        m = r.model or "unknown"
        s = model_stats.setdefault(m, {"calls": 0, "tokens": 0, "cost": 0.0})
        s["calls"] += 1
        s["tokens"] += (r.input_tokens or 0) + (r.output_tokens or 0)
        s["cost"] += r.cost_cny or 0
    models = [
        {
            "model": m,
            "label": _model_label(m),
            "calls": s["calls"],
            "tokens": s["tokens"],
            "cost": round(s["cost"], 4),
        }
        for m, s in sorted(model_stats.items(), key=lambda kv: -kv[1]["calls"])
    ]

    # 消耗分布时序：bucket → {model: tokens}
    buckets = {}
    for r in records:
        key = _bucket_format(days, r.created_at)
        b = buckets.setdefault(key, {})
        m = r.model or "unknown"
        b[m] = b.get(m, 0) + (r.input_tokens or 0) + (r.output_tokens or 0)

    # 保证时间轴连续（按天/按小时补零）
    series = []
    if days <= 3:
        total_hours = days * 24
        for i in range(total_hours - 1, -1, -1):
            t = now - timedelta(hours=i)
            key = t.strftime("%m-%d %H:00")
            series.append({"bucket": key, **(buckets.get(key, {}))})
    else:
        for i in range(days - 1, -1, -1):
            t = now - timedelta(days=i)
            key = t.strftime("%m-%d")
            series.append({"bucket": key, **(buckets.get(key, {}))})

    return {
        "days": days,
        "total_calls": total_calls,
        "total_tokens": total_tokens,
        "avg_tpm": avg_tpm,
        "avg_rpm": avg_rpm,
        "total_cost": total_cost,
        "currency": "CNY",
        "models": models,
        "series": series,
        "series_unit": "tokens",
        "updated_at": now.isoformat(),
    }


@router.get("/routes")
def analytics_routes(
    days: int = Query(7, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """分流：模型→上游渠道路由表 + 各渠道真实调用统计"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # 各模型实际使用量（用于渠道统计）
    usage_rows = (
        db.query(UsageRecord.model, func.count(UsageRecord.id), func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens), func.sum(UsageRecord.cost_cny))
        .filter(UsageRecord.user_id == user.id, UsageRecord.created_at >= cutoff)
        .group_by(UsageRecord.model)
        .all()
    )
    usage_map = {
        m: {"calls": int(c or 0), "tokens": int(t or 0), "cost": round(float(cost or 0), 4)}
        for m, c, t, cost in usage_rows
    }

    # 路由表（真实 MODEL_ROUTES）
    routes = []
    for model, (provider, endpoint) in sorted(MODEL_ROUTES.items()):
        costs = MODEL_COST.get(model)
        routes.append({
            "model": model,
            "label": _model_label(model),
            "provider": provider,
            "provider_label": PROVIDER_LABELS.get(provider, provider),
            "endpoint": endpoint,
            "upstream_model": UPSTREAM_MODEL_NAME.get(model, model),
            "cost_in": costs[0] if costs else None,
            "cost_out": costs[1] if costs else None,
            "usage": usage_map.get(model, {"calls": 0, "tokens": 0, "cost": 0.0}),
        })

    # 渠道汇总
    channels = {}
    for model, (provider, endpoint) in MODEL_ROUTES.items():
        u = usage_map.get(model, {"calls": 0, "tokens": 0, "cost": 0.0})
        ch = channels.setdefault(provider, {"provider": provider, "label": PROVIDER_LABELS.get(provider, provider), "calls": 0, "tokens": 0, "cost": 0.0, "models": []})
        ch["calls"] += u["calls"]
        ch["tokens"] += u["tokens"]
        ch["cost"] += u["cost"]
        ch["models"].append({"model": model, "label": _model_label(model), **u})
    channels = [ch for _, ch in sorted(channels.items(), key=lambda kv: -kv[1]["calls"])]

    return {
        "days": days,
        "channels": channels,
        "routes": routes,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _model_label(model: str) -> str:
    """模型显示名（与 monitor.py 的 MODEL_LABELS 保持一致）"""
    labels = {
        "gpt-5.5": "GPT-5.5",
        "openai/gpt-5.6-luna": "GPT-5.6 Luna",
        "openai/gpt-5.6-sol": "GPT-5.6 Sol",
        "openai/gpt-5.6-terra": "GPT-5.6 Terra",
        "deepseek-v3": "DeepSeek V3",
        "deepseek-r1": "DeepSeek R1",
        "deepseek/deepseek-v4-pro": "DeepSeek V4 Pro",
        "deepseek/deepseek-v4-flash": "DeepSeek V4 Flash",
        "deepseek/deepseek-v3.2": "DeepSeek V3.2",
        "qwen3-max": "Qwen3 Max",
        "qwen/qwen3.7-max": "Qwen3.7 Max",
        "qwen/qwen3.8-max": "Qwen3.8 Max",
        "glm-5.2": "GLM-5.2",
        "glm-4.6v-flash": "GLM-4.6V Flash",
        "moonshotai/kimi-k2.6": "Kimi K2.6",
        "moonshotai/kimi-k3": "Kimi K3",
        "qwen3.5-397b-a17b": "Qwen3.5 397B",
        "MiniMax-M1": "MiniMax M1",
        "minimax/minimax-m3": "MiniMax M3",
        "moonshotai/kimi-k2.7-code": "Kimi K2.7 Code",
        "anthropic/claude-fable-5": "Claude Fable 5",
        "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
        "claude-3-opus-20240229": "Claude 3 Opus",
        "claude-3-haiku-20240307": "Claude 3 Haiku",
    }
    return labels.get(model, model)
