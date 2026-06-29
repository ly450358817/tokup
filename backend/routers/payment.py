"""
TokUp · 脉充 — 通用支付接口
支持 码支付(codepay) / PayJS / 自定义聚合支付
"""
import os, json, hashlib, uuid, hmac
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx
import io
import base64

from database import get_db
from models import User, Transaction
from routers.auth import get_current_user

router = APIRouter(prefix="/api/payment", tags=["payment"])

PACKAGES = {
    "trial":  {"price": 9.9,   "tokens": 990,  "label": "体验包"},
    "light":  {"price": 29.9,  "tokens": 2990, "label": "轻量包"},
    "standard": {"price": 99.0,  "tokens": 9900, "label": "标准包"},
    "pro":    {"price": 299.0, "tokens": 29900, "label": "专业包"},
}

# ── 支付渠道配置（环境变量）──
PAY_CHANNEL = os.getenv("PAY_CHANNEL", "mock")  # mock | manual | payjs | custom

# 手动收款（最稳定，零依赖）
MANUAL_ALIPAY_QR = os.getenv("MANUAL_ALIPAY_QR", "")    # 你的个人支付宝收款码图片URL
MANUAL_WECHAT_QR = os.getenv("MANUAL_WECHAT_QR", "")    # 你的个人微信收款码图片URL

# PayJS (payjs.cn) — 仅微信支付，个人可用
PAYJS_MCHID = os.getenv("PAYJS_MCHID", "")      # PayJS 商户号
PAYJS_KEY = os.getenv("PAYJS_KEY", "")           # PayJS 密钥
PAYJS_URL = os.getenv("PAYJS_URL", "https://payjs.cn/api/native")

# 自定义支付（可对接任意支持表单提交的支付平台）
CUSTOM_API_URL = os.getenv("CUSTOM_API_URL", "")
CUSTOM_APP_ID = os.getenv("CUSTOM_APP_ID", "")
CUSTOM_APP_KEY = os.getenv("CUSTOM_APP_KEY", "")
CUSTOM_SIGN_TYPE = os.getenv("CUSTOM_SIGN_TYPE", "md5")  # md5 | hmac

# ── XorPay (码支付) ──
XORPAY_AID = os.getenv("XORPAY_AID", "")
XORPAY_APP_SECRET = os.getenv("XORPAY_APP_SECRET", "")
XORPAY_API_URL = "https://xorpay.com/api/pay"


def xorpay_sign(*args):
    """XorPay MD5 signature — values concatenated in order"""
    return hashlib.md5(''.join(str(a) for a in args).encode('utf-8')).hexdigest().lower()




BASE_URL = os.getenv("TOKUP_BASE_URL", "http://localhost:3000")


class RechargeReq(BaseModel):
    package: str
    payment_method: str = "alipay"


@router.get("/qr/{method}")
def get_payment_qr(method: str):
    """Get merchant QR code (proxied, hides real path)"""
    from fastapi.responses import FileResponse
    import os as _os
    uploads = _os.path.join(_os.path.dirname(__file__), "..", "uploads")
    env_key = f"MANUAL_{method.upper()}_QR"
    env_val = _os.environ.get(env_key, "")
    if env_val and env_val.startswith("/"):
        if _os.path.exists(env_val):
            return FileResponse(env_val, media_type="image/png")
    for ext in ["png", "jpg", "jpeg", "gif"]:
        fname = _os.path.join(uploads, f"{method.lower()}.{ext}")
        if _os.path.exists(fname):
            return FileResponse(fname, media_type=f"image/{ext}")
    from fastapi.responses import JSONResponse
    return JSONResponse({"error": "QR not configured"}, status_code=404)


@router.post("/qr/upload")
async def upload_qr(
    method: str = Form("alipay"),
    file: UploadFile = File(None),
    user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload payment QR image (admin only)"""
    from fastapi import HTTPException
    import shutil
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    save_path = os.path.join(os.path.dirname(__file__), "..", "uploads", f"{method}.{ext}")
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"success": True, "path": f"/api/payment/qr/{method}"}


@router.get("/packages")
def get_packages():
    return {"packages": PACKAGES, "channel": PAY_CHANNEL}


@router.post("/recharge")
async def recharge(req: RechargeReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pkg = PACKAGES.get(req.package)
    if not pkg:
        return {"success": False, "message": "Invalid package"}

    order_id = f"TK{uuid.uuid4().hex[:12].upper()}"

    # Save order
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

    notify_url = f"{BASE_URL}/api/payment/notify"
    return_url = f"{BASE_URL}/#/"
    method_map = {"alipay": "alipay", "wechat": "wxpay"}

    # ── 手动收款（个人支付宝/微信收款码）──
    if PAY_CHANNEL == "manual":
        qr_url = f"/api/payment/qr/{req.payment_method}"
        return {
            "success": True,
            "order_id": order_id,
            "pay_url": qr_url,
            "pay_amount": pkg["price"],
            "package": pkg,
            "channel": "manual",
            "note": "请扫码付款后，在订单页面点击「我已付款」等待确认",
        }

    # ── PayJS（仅微信支付） ──
    if PAY_CHANNEL == "payjs" and PAYJS_MCHID and PAYJS_KEY:
        try:
            pay_data = {
                "mchid": PAYJS_MCHID,
                "total_fee": int(pkg["price"] * 100),  # 单位：分
                "out_trade_no": order_id,
                "notify_url": notify_url,
            }
            # PayJS 签名: MD5(参数拼接+&key=密钥)
            sign_str = "&".join(f"{k}={v}" for k, v in sorted(pay_data.items()))
            sign_str += f"&key={PAYJS_KEY}"
            pay_data["sign"] = hashlib.md5(sign_str.encode("utf-8")).hexdigest().upper()

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(PAYJS_URL, json=pay_data)
                result = resp.json()
                if result.get("return_code") == 1 and result.get("return_msg") == "SUCCESS":
                    return {
                        "success": True,
                        "order_id": order_id,
                        "pay_url": result.get("code_url", ""),
                        "pay_amount": pkg["price"],
                        "package": pkg,
                        "channel": "payjs",
                    }
                else:
                    return {"success": False, "message": result.get("return_msg", "PayJS error")}
        except Exception as e:
            return {"success": False, "message": f"PayJS error: {str(e)}"}


    # ── XorPay（微信NATIVE / 支付宝当面付） ──
    if PAY_CHANNEL == "xorpay" and XORPAY_AID and XORPAY_APP_SECRET:
        try:
            pay_type = "native" if req.payment_method == "wechat" else "alipay"
            name = f"TokUp {pkg['label']}"
            price = f"{pkg['price']:.2f}"

            sign = xorpay_sign(name, pay_type, price, order_id, notify_url, XORPAY_APP_SECRET)

            pay_data = {
                "name": name,
                "pay_type": pay_type,
                "price": price,
                "order_id": order_id,
                "notify_url": notify_url,
                "sign": sign,
            }

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{XORPAY_API_URL}/{XORPAY_AID}",
                    data=pay_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                result = resp.json()

                if result.get("status") == "ok" and "info" in result:
                    qr_content = result["info"].get("qr", "")
                    aoid = result["info"].get("aoid", "")

                    # Save QR image as file
                    pay_url = ""
                    if qr_content:
                        try:
                            import qrcode as _qr
                            qr_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist", "assets", "qr")
                            os.makedirs(qr_dir, exist_ok=True)
                            qr_path = os.path.join(qr_dir, f"{order_id}.png")
                            _qr.make(qr_content, box_size=8, border=2).save(qr_path)
                            pay_url = f"/assets/qr/{order_id}.png"
                        except (ImportError, Exception):
                            pay_url = qr_content

                    return {
                        "success": True,
                        "order_id": order_id,
                        "pay_url": pay_url,
                        "pay_amount": pkg["price"],
                        "package": pkg,
                        "channel": "xorpay",
                        "aoid": aoid,
                    }
                else:
                    status = result.get("status", "XorPay error")
                    msg = result.get("info", "") if isinstance(result.get("info"), str) else ""
                    return {"success": False, "message": f"{status}: {msg}"}
        except Exception as e:
            return {"success": False, "message": f"XorPay error: {str(e)}"}

    # ── 自定义支付渠道 ──
    if PAY_CHANNEL == "custom" and CUSTOM_API_URL and CUSTOM_APP_ID and CUSTOM_APP_KEY:
        try:
            pay_data = {
                "app_id": CUSTOM_APP_ID,
                "order_id": order_id,
                "amount": pkg["price"],
                "currency": "CNY",
                "method": method_map.get(req.payment_method, "alipay"),
                "notify_url": notify_url,
                "return_url": return_url,
                "timestamp": datetime.now().strftime("%Y%m%d%H%M%S"),
            }
            if CUSTOM_SIGN_TYPE == "hmac":
                sign_str = "&".join(f"{k}={v}" for k, v in sorted(pay_data.items()))
                pay_data["sign"] = hmac.new(
                    CUSTOM_APP_KEY.encode(), sign_str.encode(), hashlib.md5
                ).hexdigest()
            else:
                sign_str = "&".join(f"{k}={v}" for k, v in sorted(pay_data.items()))
                sign_str += f"&key={CUSTOM_APP_KEY}"
                pay_data["sign"] = hashlib.md5(sign_str.encode("utf-8")).hexdigest()

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(CUSTOM_API_URL, json=pay_data)
                result = resp.json()
                pay_url = result.get("pay_url") or result.get("data", {}).get("pay_url", "")
                if pay_url:
                    return {
                        "success": True,
                        "order_id": order_id,
                        "pay_url": pay_url,
                        "pay_amount": pkg["price"],
                        "package": pkg,
                        "channel": "custom",
                    }
                return {"success": False, "message": result.get("msg", "Gateway error")}
        except Exception as e:
            return {"success": False, "message": f"Custom payment error: {str(e)}"}

    # ── Mock 模式 ──
    mock_url = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=tokup-{order_id}"
    return {
        "success": True,
        "order_id": order_id,
        "pay_url": mock_url,
        "pay_amount": pkg["price"],
        "package": pkg,
        "channel": "mock",
        "message": "⚠ Mock mode. Set PAY_CHANNEL and credentials for real payments.",
    }


@router.post("/notify")
async def payment_notify(request: Request, db: Session = Depends(get_db)):
    """支付异步通知回调"""
    form = await request.form()
    data = dict(form)
    # ── XorPay 回调 ──
    xorpay_aoid = data.get("aoid", "")
    xorpay_order_id = data.get("order_id", "")
    if xorpay_aoid and xorpay_order_id and XORPAY_APP_SECRET:
        pay_price = data.get("pay_price", "0")
        pay_time = data.get("pay_time", "")
        xorpay_sign_received = data.get("sign", "")

        expected = xorpay_sign(xorpay_aoid, xorpay_order_id, pay_price, pay_time, XORPAY_APP_SECRET)
        if xorpay_sign_received != expected:
            return {"code": 0, "msg": "sign error"}

        txn = db.query(Transaction).filter(Transaction.payment_id == xorpay_order_id).first()
        if txn and txn.status == "pending":
            txn.status = "completed"
            user = db.query(User).filter(User.id == txn.user_id).first()
            if user:
                user.token_balance += txn.token_amount
                user.total_recharged += txn.amount
                user.updated_at = datetime.now(timezone.utc)
            db.commit()
        return {"code": 1, "msg": "success"}



    order_id = data.get("order_id") or data.get("out_trade_no") or data.get("pay_id", "")
    status = data.get("status") or data.get("return_code", "")
    sign = data.get("sign", "")

    # 码支付 sign 验证
    if PAY_CHANNEL == "codepay" and CODEPAY_KEY:
        sign_str = "&".join(f"{k}={v}" for k, v in sorted(data.items()) if k != "sign")
        sign_str += f"&key={CODEPAY_KEY}"
        expected = hashlib.md5(sign_str.encode("utf-8")).hexdigest()
        if sign != expected:
            return {"code": 0, "msg": "sign error"}

    if order_id and (status in ("success", "1", "paid") or data.get("return_code") == "1"):
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

    return {"code": 0, "msg": "failed"}


@router.get("/orders")
def list_orders(
    status: str = "pending",
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List payment orders (admin gets all, users see their own)"""
    from sqlalchemy import desc
    
    q = db.query(Transaction)
    if status:
        q = q.filter(Transaction.status == status, Transaction.type == "recharge")
    if not user.is_admin:
        q = q.filter(Transaction.user_id == user.id)
    orders = q.order_by(desc(Transaction.created_at)).limit(limit).all()
    
    return [
        {
            "id": t.id,
            "order_id": t.payment_id,
            "amount": t.amount,
            "tokens": t.token_amount,
            "method": t.payment_method,
            "status": t.status,
            "description": t.description,
            "user_id": t.user_id,
            "created_at": t.created_at.isoformat(),
        }
        for t in orders
    ]


@router.post("/orders/{order_id}/confirm")
def confirm_order(
    order_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin confirms payment received"""
    from fastapi import HTTPException
    from datetime import datetime, timezone
    
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    txn = db.query(Transaction).filter(
        Transaction.payment_id == order_id,
        Transaction.type == "recharge",
        Transaction.status == "pending",
    ).first()
    
    if not txn:
        raise HTTPException(status_code=404, detail="Order not found")
    
    txn.status = "completed"
    txn_user = db.query(User).filter(User.id == txn.user_id).first()
    if txn_user:
        txn_user.token_balance += txn.token_amount
        txn_user.total_recharged += txn.amount
        txn_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    
    return {"success": True, "message": "Payment confirmed", "user_id": txn.user_id, "amount": txn.amount}


@router.post("/orders/{order_id}/notify-paid")
def user_notify_paid(
    order_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """User confirms payment - auto-adds balance"""
    from fastapi import HTTPException
    from datetime import datetime, timezone
    
    txn = db.query(Transaction).filter(
        Transaction.payment_id == order_id,
        Transaction.user_id == user.id,
        Transaction.type == "recharge",
        Transaction.status == "pending",
    ).first()
    
    if not txn:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Auto-confirm: add balance immediately
    txn.status = "completed"
    txn_user = db.query(User).filter(User.id == user.id).first()
    if txn_user:
        txn_user.token_balance += txn.token_amount
        txn_user.total_recharged += txn.amount
        txn_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    
    return {
        "success": True,
        "message": "Payment confirmed! Balance added.",
        "balance": txn_user.token_balance if txn_user else 0,
        "added": txn.amount,
    }


@router.get("/order/{order_id}")
def get_order_status(
    order_id: str,
    db: Session = Depends(get_db),
):
    """Check order status (no auth needed - order_id is unguessable UUID)"""
    txn = db.query(Transaction).filter(
        Transaction.payment_id == order_id,
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "order_id": txn.payment_id,
        "status": txn.status,
        "amount": txn.amount,
        "tokens": txn.token_amount,
        "method": txn.payment_method,
        "created_at": txn.created_at.isoformat(),
    }
