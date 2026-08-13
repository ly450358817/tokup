"""
Token 管理服务
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import User, Transaction


TOKEN_TO_CNY_RATIO = 100  # 1 元 = 100 token


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
    """扣除 token，amount 为 token 数量（1 元 = 100 token）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"success": False, "message": "User not found"}
    if user.token_balance < amount:
        return {"success": False, "message": "余额不足"}
    
    user.token_balance -= amount
    user.updated_at = datetime.now(timezone.utc)

    txn = Transaction(
        user_id=user_id,
        amount=round(amount / 100, 2),
        token_amount=amount,
        type="consume",
        status="completed",
        description=description or "API call"
    )
    db.add(txn)

    # 消费分成：消费额的 10% 给邀请人
    if user.referred_by:
        referrer = db.query(User).filter(User.id == user.referred_by).first()
        if referrer:
            comm_amount = int(amount * 0.1)
            if comm_amount > 0:
                referrer.token_balance += comm_amount
                db.add(Transaction(
                    user_id=referrer.id,
                    amount=round(comm_amount / 100, 2),
                    token_amount=comm_amount,
                    type="recharge",
                    status="completed",
                    description="提成 (" + str(int(amount)) + " 消费 x 10%)"
                ))

    db.commit()
    db.refresh(user)

    return {"success": True, "balance": user.token_balance, "deducted": amount}


def has_completed_recharge(user_id: str, db: Session) -> bool:
    """真实充值成功（有支付方式/流水号，排除赠送与邀请提成）"""
    return (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.type == "recharge",
            Transaction.status == "completed",
            Transaction.payment_method != "",
            Transaction.amount > 0,
        )
        .first()
        is not None
    )


def reserve_token(user_id: str, amount: float, db: Session, description: str = "") -> dict:
    """预扣 token（冻结余额，不生成 consume 流水），结算时按实际用量记账。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"success": False, "message": "User not found"}
    if user.token_balance < amount:
        return {"success": False, "message": "余额不足"}
    user.token_balance -= amount
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return {"success": True, "balance": user.token_balance, "reserved": amount}


def settle_reserved(user_id: str, reserved: float, actual: float, db: Session, description: str = "") -> dict:
    """结算预扣：恢复冻结金额后按实际用量扣费，退回差额或补扣超支。"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {"success": False, "message": "User not found"}
    user.token_balance += reserved
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    if actual <= 0:
        return {"success": True, "balance": user.token_balance, "refunded": reserved, "deducted": 0}
    if actual > user.token_balance:
        actual = max(user.token_balance, 0)  # 极端超支时收走全部余额，避免倒贴
    return deduct_token(user_id, actual, db, description)


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
