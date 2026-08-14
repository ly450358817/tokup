"""
Token 管理服务（原子化：余额增减一律走 SQL UPDATE，防并发读改写竞态导致白嫖/超扣）
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import update
from models import User, Transaction


TOKEN_TO_CNY_RATIO = 100  # 1 元 = 100 token


def _now():
    return datetime.now(timezone.utc)


def get_balance(user_id: str, db: Session) -> float:
    user = db.query(User).filter(User.id == user_id).first()
    return user.token_balance if user else 0.0


def add_token(user_id: str, amount_cny: float, db: Session, payment_method: str = "", payment_id: str = "") -> dict:
    """用户充值，amount_cny 单位为元（原子加余额）"""
    token_amount = amount_cny * TOKEN_TO_CNY_RATIO
    res = db.execute(
        update(User)
        .where(User.id == user_id)
        .values(
            token_balance=User.token_balance + token_amount,
            total_recharged=User.total_recharged + amount_cny,
            updated_at=_now(),
        )
    )
    if res.rowcount != 1:
        return {"success": False, "message": "User not found"}

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
    db.add(txn)
    db.commit()

    return {"success": True, "balance": get_balance(user_id, db), "added": token_amount}


def deduct_token(user_id: str, amount: float, db: Session, description: str = "") -> dict:
    """扣除 token（原子：余额 >= amount 才扣，并发安全）"""
    if amount <= 0:
        return {"success": True, "balance": get_balance(user_id, db), "deducted": 0}
    res = db.execute(
        update(User)
        .where(User.id == user_id, User.token_balance >= amount)
        .values(token_balance=User.token_balance - amount, updated_at=_now())
    )
    if res.rowcount != 1:
        return {"success": False, "message": "余额不足"}

    user = db.query(User).filter(User.id == user_id).first()
    db.add(Transaction(
        user_id=user_id,
        amount=round(amount / 100, 2),
        token_amount=amount,
        type="consume",
        status="completed",
        description=description or "API call"
    ))

    # 消费分成：消费额的 10% 给邀请人
    if user and user.referred_by:
        referrer = db.query(User).filter(User.id == user.referred_by).first()
        if referrer:
            comm_amount = int(amount * 0.1)
            if comm_amount > 0:
                db.execute(
                    update(User)
                    .where(User.id == referrer.id)
                    .values(token_balance=User.token_balance + comm_amount, updated_at=_now())
                )
                db.add(Transaction(
                    user_id=referrer.id,
                    amount=round(comm_amount / 100, 2),
                    token_amount=comm_amount,
                    type="recharge",
                    status="completed",
                    description="提成 (" + str(int(amount)) + " 消费 x 10%)"
                ))

    db.commit()
    return {"success": True, "balance": get_balance(user_id, db), "deducted": amount}


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
    """预扣 token（原子：余额 >= amount 才扣，并发安全；结算时按实际用量记账）"""
    if amount <= 0:
        return {"success": True, "balance": get_balance(user_id, db), "reserved": 0}
    res = db.execute(
        update(User)
        .where(User.id == user_id, User.token_balance >= amount)
        .values(token_balance=User.token_balance - amount, updated_at=_now())
    )
    if res.rowcount != 1:
        return {"success": False, "message": "余额不足"}
    db.commit()
    return {"success": True, "balance": get_balance(user_id, db), "reserved": amount}


def settle_reserved(user_id: str, reserved: float, actual: float, db: Session, description: str = "") -> dict:
    """结算预扣：恢复冻结金额后按实际用量扣费，退回差额或补扣超支（原子化）"""
    if reserved > 0:
        db.execute(
            update(User)
            .where(User.id == user_id)
            .values(token_balance=User.token_balance + reserved, updated_at=_now())
        )
        db.commit()
    if actual <= 0:
        return {"success": True, "balance": get_balance(user_id, db), "refunded": reserved, "deducted": 0}
    balance = get_balance(user_id, db)
    if actual > balance:
        actual = max(balance, 0)  # 极端超支时收走全部余额，避免倒贴
    if actual <= 0:
        return {"success": True, "balance": 0.0, "refunded": reserved, "deducted": 0}
    r = deduct_token(user_id, actual, db, description)
    if not r["success"]:
        # 并发下余额可能已被其它请求扣走：把剩余余额清零作为实际扣费，避免白嫖
        db.execute(
            update(User)
            .where(User.id == user_id, User.token_balance > 0)
            .values(token_balance=0, updated_at=_now())
        )
        db.commit()
        return {"success": True, "balance": 0.0, "refunded": reserved, "deducted": 0}
    return r


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
