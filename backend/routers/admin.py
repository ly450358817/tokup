from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import SessionLocal
from models import User, Transaction, ApiKey

router = APIRouter(prefix="/api/admin", tags=["admin"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/stats")
def admin_stats(db: Session = Depends(get_db)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_recharged = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(Transaction.status == "completed").scalar() or 0
    total_consumed = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(Transaction.type == "deduction").scalar() or 0
    total_keys = db.query(func.count(ApiKey.id)).scalar() or 0
    active_keys = db.query(func.count(ApiKey.id)).filter(ApiKey.is_active == True).scalar() or 0
    return {
        "total_users": total_users,
        "total_recharged": round(total_recharged / 100, 2),
        "total_consumed": round(total_consumed / 100, 2),
        "total_keys": total_keys,
        "active_keys": active_keys,
    }
