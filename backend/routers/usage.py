"""
TokUp · 脉充 — 消费明细 / 审计日志 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import UsageRecord
from routers.auth import get_current_user
from models import User
from datetime import datetime, timezone
import csv
import io

router = APIRouter(prefix="/api/usage", tags=["usage"])


@router.get("/records")
def get_usage_records(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    model: str = Query("", description="Filter by model"),
    days: int = Query(7, description="Days of history"),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
):
    """返回用户的使用明细（合规审计用）"""
    q = db.query(UsageRecord).filter(UsageRecord.user_id == user.id)
    if model:
        q = q.filter(UsageRecord.model == model)
    if days > 0:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        q = q.filter(UsageRecord.created_at >= cutoff)
    total = q.count()
    records = q.order_by(desc(UsageRecord.created_at)).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": [
            {
                "id": r.id,
                "model": r.model,
                "provider": "tokup",
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "cost_cny": r.cost_cny,
                "latency_ms": r.latency_ms,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in records
        ],
    }


@router.get("/export")
def export_usage_csv(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(30),
    model: str = Query(""),
):
    """导出使用记录为 CSV（审计用）"""
    q = db.query(UsageRecord).filter(UsageRecord.user_id == user.id)
    if model:
        q = q.filter(UsageRecord.model == model)
    if days > 0:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        q = q.filter(UsageRecord.created_at >= cutoff)
    records = q.order_by(desc(UsageRecord.created_at)).limit(10000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["时间", "模型", "提供商", "输入Token", "输出Token", "费用(元)", "延迟(ms)", "状态"])
    for r in records:
        writer.writerow([
            r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            r.model, "tokup", r.input_tokens, r.output_tokens,
            r.cost_cny, r.latency_ms or "", r.status,
        ])
    csv_content = output.getvalue()
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tokup-usage-export.csv"},
    )


@router.get("/summary")
def usage_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(30),
):
    """按模型聚合消费统计"""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    records = db.query(UsageRecord).filter(
        UsageRecord.user_id == user.id,
        UsageRecord.created_at >= cutoff,
    ).all()

    model_stats = {}
    for r in records:
        if r.model not in model_stats:
            model_stats[r.model] = {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0}
        model_stats[r.model]["calls"] += 1
        model_stats[r.model]["input_tokens"] += r.input_tokens
        model_stats[r.model]["output_tokens"] += r.output_tokens
        model_stats[r.model]["cost"] += r.cost_cny

    return {
        "total_calls": len(records),
        "total_cost": round(sum(r.cost_cny for r in records), 4),
        "total_tokens": sum(r.input_tokens + r.output_tokens for r in records),
        "models": model_stats,
    }
