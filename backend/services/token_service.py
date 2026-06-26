"""
Token 管理服务
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import User, Transaction


TOKEN_TO_CNY_RATIO = 100  # 1 元 = 100 token 分


def get_balance(user_id: str, db: Session) -> float:
    user = db.query(User).filter(User.id == user_id).first()
    return user.token_balance if user else 0.0


def add_token(user_id: str, amount_cny: float, db: Session, payment_method: str = "", payment_id: str = "") -> dict:
    """用户充值，amount_cny 单位为元"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"success": False, "message": "User not found"}

    token_amount = amount_cny * TOKEN_TO_CNY_RATIO

    txn = Transaction(
        user_id=user_id,
        amount=amount_cny,
        token_amount=token_amount,
        type="recharge",
        status="completed",
        payment_method=payment_method,
        payment_id=payment_id,
        description=f"Recharge ¥{amount_cny}"
    )
    user.token_balance += token_amount
    user.total_recharged += amount_cny
    user.updated_at = datetime.now(timezone.utc)

    db.add(txn)
    db.commit()
    db.refresh(user)

    return {"success": True, "balance": user.token_balance, "added": token_amount}


def deduct_token(user_id: str, amount: float, db: Session, description: str = "") -> dict:
    """扣除 token，amount 为 token 分"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"success": False, "message": "User not found"}
    if user.token_balance < amount:
        return {"success": False, "message": "Insufficient balance"}
    
    user.token_balance -= amount
    user.updated_at = datetime.now(timezone.utc)

    txn = Transaction(
        user_id=user_id,
        amount=0,
        token_amount=amount,
        type="consume",
        status="completed",
        description=description or "API call"
    )
    db.add(txn)
    db.commit()
    db.refresh(user)

    return {"success": True, "balance": user.token_balance, "deducted": amount}


def get_transactions(user_id: str, db: Session, limit: int = 50, type_filter: str = "",
                              start_date: str = "", end_date: str = "", search: str = ""):
    q = db.query(Transaction).filter(Transaction.user_id == user_id)
    if type_filter:
        q = q.filter(Transaction.type == type_filter)
    if start_date:
        from datetime import datetime as _dt
        try:
            sd = _dt.fromisoformat(start_date)
            q = q.filter(Transaction.created_at >= sd)
        except: pass
    if end_date:
        from datetime import datetime as _dt, timedelta
        try:
            ed = _dt.fromisoformat(end_date) + timedelta(days=1)
            q = q.filter(Transaction.created_at < ed)
        except: pass
    if search:
        q = q.filter(Transaction.description.ilike(f"%{search}%"))
    txns = q.order_by(Transaction.created_at.desc()).limit(limit).all()
    return [
        {
            "id": t.id,
            "amount": t.amount,
            "token_amount": t.token_amount,
            "type": t.type,
            "status": t.status,
            "payment_method": t.payment_method,
            "description": t.description,
            "created_at": t.created_at.isoformat(),
        }
        for t in txns
    ]
