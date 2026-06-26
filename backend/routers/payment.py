"""
TokUp · 脉充 — 支付接口（虎皮椒 xmpay 集成）
"""
import os, json, hashlib, uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from database import get_db
from models import User, Transaction
from routers.auth import get_current_user
from services.token_service import add_token

router = APIRouter(prefix="/api/payment", tags=["payment"])

PACKAGES = {
    "trial": {"price": 9.9, "tokens": 990, "label": "体验包"},
    "light": {"price": 29.9, "tokens": 2990, "label": "轻量包"},
    "standard": {"price": 99.0, "tokens": 9900, "label": "标准包"},
    "pro": {"price": 299.0, "tokens": 29900, "label": "专业包"},
}

# 虎皮椒配置（通过环境变量设置）
XMPAY_URL = os.getenv("XMPAY_URL", "https://api.xmpay.com/api/pay")
XMPAY_APP_ID = os.getenv("XMPAY_APP_ID", "")  # 你的应用ID
XMPAY_APP_SECRET = os.getenv("XMPAY_APP_SECRET", "")  # 你的应用密钥
BASE_URL = os.getenv("TOKUP_BASE_URL", "http://localhost:3000")

class RechargeReq(BaseModel):
    package: str
    payment_method: str = "alipay"


@router.get("/packages")
def get_packages():
    return {"packages": PACKAGES}


@router.post("/recharge")
async def recharge(req: RechargeReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pkg = PACKAGES.get(req.package)
    if not pkg:
        return {"success": False, "message": "Invalid package"}

    order_id = f"TK{uuid.uuid4().hex[:12].upper()}"

    # Save order to DB
    txn = Transaction(
        user_id=user.id,
        amount=pkg["price"],
        token_amount=pkg["tokens"],
        type="recharge",
        status="pending",
        payment_method=req.payment_method,
        payment_id=order_id,
        description=f"{pkg['label']} ¥{pkg['price']}"
    )
    db.add(txn)
    db.commit()

    # If 虎皮椒 is configured, create real payment
    if XMPAY_APP_ID and XMPAY_APP_SECRET:
        try:
            notify_url = f"{BASE_URL}/api/payment/notify"
            return_url = f"{BASE_URL}/#/payment-success"
            pay_data = {
                "pay_id": XMPAY_APP_ID,
                "type": req.payment_method,
                "price": str(pkg["price"]),
                "order_id": order_id,
                "return_url": return_url,
                "notify_url": notify_url,
            }
            # Generate sign
            sign_str = "&".join(f"{k}={v}" for k,v in sorted(pay_data.items()))
            sign_str += XMPAY_APP_SECRET
            pay_data["sign"] = hashlib.md5(sign_str.encode()).hexdigest()

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(XMPAY_URL, data=pay_data)
                result = resp.json()
                if result.get("code") == 1:
                    return {
                        "success": True,
                        "order_id": order_id,
                        "pay_url": result["data"]["pay_url"],
                        "pay_amount": pkg["price"],
                        "package": pkg,
                    }
                else:
                    return {"success": False, "message": result.get("msg", "Payment gateway error")}
        except Exception as e:
            return {"success": False, "message": f"Payment error: {str(e)}"}

    # Fallback: mock QR
    mock_qr = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=tokup-{order_id}"
    return {
        "success": True,
        "order_id": order_id,
        "pay_url": mock_qr,
        "pay_amount": pkg["price"],
        "package": pkg,
        "message": "Mock payment. Set XMPAY env vars for real payments.",
    }


@router.post("/notify")
async def payment_notify(request: Request, db: Session = Depends(get_db)):
    """虎皮椒异步通知回调"""
    form = await request.form()
    data = dict(form)
    order_id = data.get("order_id", "")
    price = data.get("price", "0")
    status = data.get("status", "failed")
    sign = data.get("sign", "")

    # Verify sign
    sign_str = "&".join(f"{k}={v}" for k,v in sorted(data.items()) if k != "sign")
    sign_str += XMPAY_APP_SECRET
    expected_sign = hashlib.md5(sign_str.encode()).hexdigest()

    if sign != expected_sign:
        return {"code": 0, "msg": "sign error"}

    if status == "success":
        txn = db.query(Transaction).filter(Transaction.payment_id == order_id).first()
        if txn and txn.status == "pending":
            txn.status = "completed"
            user = db.query(User).filter(User.id == txn.user_id).first()
            if user:
                user.token_balance += txn.token_amount
                user.total_recharged += txn.amount
                user.updated_at = datetime.now(timezone.utc)
            db.commit()

    return {"code": 1, "msg": "success"}
