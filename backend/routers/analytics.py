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
from services.ai_service import MODEL_ROUTES, MODEL_COST, UPSTREAM_MODEL_NAME, QINIU_ENDPOINT, ZHIPU_ENDPOINT, MODEL_META

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# 上游商家名不对外暴露，统一显示为 TokUp（商业保密 + 防止用户绕过平台直连上游）
PROVIDER_LABELS = {
    "qiniu": "TokUp",
    "zhipu": "TokUp",
    "openai": "TokUp",
    "anthropic": "TokUp",
    "deepseek": "TokUp",
    "": "TokUp",
}


def _minutes_in_range(days: int = 0, start: datetime | None = None, end: datetime | None = None) -> int:
    """范围内实际分钟数（用于 TPM/RPM 分母，至少 1 分钟）"""
    if start and end and end > start:
        return max(1, int((end - start).total_seconds() // 60))
    return max(1, days * 24 * 60)


def _bucket_format(span_days: float, dt: datetime) -> str:
    """根据时间范围选择聚合粒度：<=3天按小时，否则按天"""
    if span_days <= 3:
        return dt.strftime("%m-%d %H:00")
    return dt.strftime("%m-%d")


@router.get("/overview")
def analytics_overview(
    days: int = Query(7, ge=1, le=365),
    start_date: str = Query("", description="自由起止：开始日期 YYYY-MM-DD（与 end_date 同时传）"),
    end_date: str = Query("", description="自由起止：结束日期 YYYY-MM-DD（含当天）"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """模型调用分析：统计卡片 + 消耗分布时序（按模型分色）。
    支持两种模式：days=N（最近 N 天）或 start_date/end_date（自由区间，含两端）。"""
    now = datetime.now(timezone.utc)
    range_start = None
    range_end = None
    span_days = float(days)

    if start_date and end_date:
        # 自由区间：北京时间 0 点 -> 结束日 23:59:59（UTC 换算）
        tz8 = timezone(timedelta(hours=8))
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=tz8)
            ed = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=tz8, hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")
        if ed < sd:
            raise HTTPException(status_code=400, detail="结束日期不能早于开始日期")
        range_start = sd.astimezone(timezone.utc)
        range_end = ed.astimezone(timezone.utc)
        if range_end > now:
            range_end = now
        span_days = max((range_end - range_start).total_seconds() / 86400, 0.01)
        query = db.query(UsageRecord).filter(
            UsageRecord.user_id == user.id,
            UsageRecord.created_at >= range_start,
            UsageRecord.created_at <= range_end,
        )
    else:
        cutoff = now - timedelta(days=days)
        query = db.query(UsageRecord).filter(
            UsageRecord.user_id == user.id,
            UsageRecord.created_at >= cutoff,
        )
    records = query.all()

    total_calls = len(records)
    total_tokens = sum((r.input_tokens or 0) + (r.output_tokens or 0) for r in records)
    total_cost = round(sum(r.cost_cny or 0 for r in records), 4)
    minutes = _minutes_in_range(days, range_start, range_end)
    avg_tpm = round(total_tokens / minutes, 1)
    avg_rpm = round(total_calls / minutes, 2)
    total_success = sum(1 for r in records if r.status == "success")
    success_rate = round((total_success / max(total_calls, 1)) * 100, 1)
    _lats = [r.latency_ms for r in records if r.latency_ms and r.latency_ms > 0]
    avg_response_ms = round(sum(_lats) / len(_lats), 1) if _lats else 0

    # 按模型聚合
    model_stats = {}
    for r in records:
        m = r.model or "unknown"
        s = model_stats.setdefault(m, {"calls": 0, "tokens": 0, "cost": 0.0, "errors": 0, "latencies": []})
        s["calls"] += 1
        s["tokens"] += (r.input_tokens or 0) + (r.output_tokens or 0)
        s["cost"] += r.cost_cny or 0
        if r.status != "success":
            s["errors"] += 1
        if r.latency_ms and r.latency_ms > 0:
            s["latencies"].append(r.latency_ms)
    models = [
        {
            "model": m,
            "label": _model_label(m),
            "calls": s["calls"],
            "tokens": s["tokens"],
            "cost": round(s["cost"], 4),
            "error_rate": round((s["errors"] / max(s["calls"], 1)) * 100, 2),
            "avg_latency_ms": round(sum(s["latencies"]) / len(s["latencies"]), 1) if s["latencies"] else 0,
        }
        for m, s in sorted(model_stats.items(), key=lambda kv: -kv[1]["calls"])
    ]

    # 消耗分布时序：bucket → {model: tokens}
    buckets = {}
    for r in records:
        key = _bucket_format(span_days, r.created_at)
        b = buckets.setdefault(key, {})
        m = r.model or "unknown"
        b[m] = b.get(m, 0) + (r.input_tokens or 0) + (r.output_tokens or 0)

    # 保证时间轴连续（按天/按小时补零）
    series = []
    if span_days <= 3:
        total_hours = int(max(span_days * 24, 1))
        end_anchor = range_end if range_end else now
        for i in range(total_hours - 1, -1, -1):
            t = end_anchor - timedelta(hours=i)
            key = t.strftime("%m-%d %H:00")
            series.append({"bucket": key, **(buckets.get(key, {}))})
    else:
        total_days = max(int(round(span_days)), 1)
        end_anchor = range_end if range_end else now
        for i in range(total_days - 1, -1, -1):
            t = end_anchor - timedelta(days=i)
            key = t.strftime("%m-%d")
            series.append({"bucket": key, **(buckets.get(key, {}))})

    return {
        "days": days,
        "start_date": range_start.strftime("%Y-%m-%d") if range_start else "",
        "end_date": range_end.strftime("%Y-%m-%d") if range_end else "",
        "total_calls": total_calls,
        "total_tokens": total_tokens,
        "avg_tpm": avg_tpm,
        "avg_rpm": avg_rpm,
        "total_cost": total_cost,
        "success_rate": success_rate,
        "avg_response_ms": avg_response_ms,
        "currency": "CNY",
        "models": models,
        "series": series,
        "series_unit": "tokens",
        "updated_at": now.isoformat(),
    }


@router.get("/routes")
def analytics_routes(
    days: int = Query(7, ge=1, le=365),
    start_date: str = Query("", description="自由起止：开始日期 YYYY-MM-DD"),
    end_date: str = Query("", description="自由起止：结束日期 YYYY-MM-DD"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """分流：模型→上游渠道路由表 + 各渠道真实调用统计（支持 days 或自由区间）"""
    now = datetime.now(timezone.utc)
    range_start = None
    range_end = None
    if start_date and end_date:
        tz8 = timezone(timedelta(hours=8))
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=tz8)
            ed = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=tz8, hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")
        if ed < sd:
            raise HTTPException(status_code=400, detail="结束日期不能早于开始日期")
        range_start = sd.astimezone(timezone.utc)
        range_end = ed.astimezone(timezone.utc)
        if range_end > now:
            range_end = now
        cutoff = range_start
        end_cut = range_end
    else:
        cutoff = now - timedelta(days=days)
        end_cut = now
    

    # 各模型实际使用量（用于渠道统计）
    usage_rows = (
        db.query(UsageRecord.model, func.count(UsageRecord.id), func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens), func.sum(UsageRecord.cost_cny))
        .filter(UsageRecord.user_id == user.id, UsageRecord.created_at >= cutoff, UsageRecord.created_at <= end_cut)
        .group_by(UsageRecord.model)
        .all()
    )
    usage_map = {
        m: {"calls": int(c or 0), "tokens": int(t or 0), "cost": round(float(cost or 0), 4)}
        for m, c, t, cost in usage_rows
    }

    # 路由表（真实 MODEL_ROUTES；渠道显示模型对应品牌提供商，不暴露上游名/URL/版本号）
    routes = []
    for model, (provider, endpoint) in sorted(MODEL_ROUTES.items()):
        costs = MODEL_COST.get(model)
        routes.append({
            "model": model,
            "label": _model_label(model),
            "provider_label": MODEL_META.get(model, {}).get("provider", "TokUp"),
            "cost_in": costs[0] if costs else None,
            "cost_out": costs[1] if costs else None,
            "usage": usage_map.get(model, {"calls": 0, "tokens": 0, "cost": 0.0}),
        })

    # 渠道汇总：按模型品牌提供商分组（如 OpenAI/DeepSeek/月之暗面，不暴露 qiniu/zhipu 上游名）
    channels_map = {}
    for model, (provider, endpoint) in MODEL_ROUTES.items():
        u = usage_map.get(model, {"calls": 0, "tokens": 0, "cost": 0.0})
        prov = MODEL_META.get(model, {}).get("provider", "TokUp")
        ch = channels_map.setdefault(prov, {"provider": prov, "label": prov, "calls": 0, "tokens": 0, "cost": 0.0, "models": []})
        ch["calls"] += u["calls"]
        ch["tokens"] += u["tokens"]
        ch["cost"] += u["cost"]
        ch["models"].append({"model": model, "label": _model_label(model), **u})
    channels = sorted(channels_map.values(), key=lambda c: -c["calls"])

    return {
        "days": days,
        "start_date": range_start.strftime("%Y-%m-%d") if range_start else "",
        "end_date": range_end.strftime("%Y-%m-%d") if range_end else "",
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
