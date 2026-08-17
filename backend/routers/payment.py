"""
TokUp · 脉充 — 通用支付接口
支持 码支付(codepay) / PayJS / 自定义聚合支付
"""
import os, json, hashlib, uuid, hmac, time, asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx
import io
import base64

from database import get_db
from models import User, Transaction
from routers.auth import get_current_user
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(prefix="/api/payment", tags=["payment"])

PACKAGES = {
    "trial": {"price": 29.9,  "tokens": 2990,  "label": "体验包 (低门槛尝鲜)"},
    "monthly": {"price": 99.0,  "tokens": 9900,  "label": "月卡 (新用户特惠)"},
    "quarterly": {"price": 199.0, "tokens": 30000, "label": "季卡"},
    "yearly":  {"price": 499.0, "tokens": 120000, "label": "年卡"},
}

# 自由充值限额（元）
MIN_RECHARGE_CNY = float(os.getenv("MIN_RECHARGE_CNY", "1"))
MAX_RECHARGE_CNY = float(os.getenv("MAX_RECHARGE_CNY", "5000"))

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
# 支付宝个人商户单笔限额（XorPay 通道：个人无执照时支付宝单笔 1000 / 日 5 万，可环境变量覆盖）
XORPAY_ALIPAY_MAX = float(os.getenv("XORPAY_ALIPAY_MAX", "1000"))


def xorpay_sign(*args):
    """XorPay MD5 signature — values concatenated in order"""
    return hashlib.md5(''.join(str(a) for a in args).encode('utf-8')).hexdigest().lower()




BASE_URL = os.getenv("TOKUP_BASE_URL", "http://localhost:3000")


def _xorpay_query_order(order_id: str) -> str:
    """查询 XorPay 订单状态：not_exist/new/payed/fee_error/success/expire"""
    try:
        sign = xorpay_sign(order_id, XORPAY_APP_SECRET)
        url = f"https://xorpay.com/api/query2/{XORPAY_AID}?order_id={order_id}&sign={sign}"
        with httpx.Client(timeout=10) as client:
            resp = client.get(url)
            return resp.json().get("status", "")
    except Exception:
        return ""


async def payment_reconcile_loop():
    """支付对账：每 5 分钟把「XorPay 已支付但回调未到」的订单自动补到账，实现全自动到账（无需联系管理员）。"""
    from database import SessionLocal
    from models import Transaction, User
    from sqlalchemy import update
    _last_checked = {}  # order_id -> 时间戳（进程内去重，避免高频轮询 XorPay）
    while True:
        try:
            db = SessionLocal()
            try:
                now = datetime.now(timezone.utc)
                cutoff = now - timedelta(minutes=3)   # 只处理 3 分钟前的单
                recent = now - timedelta(hours=24)    # 只处理 24 小时内的单（更早视为放弃）
                pendings = (
                    db.query(Transaction)
                    .filter(
                        Transaction.type == "recharge",
                        Transaction.status == "pending",
                        Transaction.payment_id.like("TK%"),
                        Transaction.created_at < cutoff,
                        Transaction.created_at >= recent,
                    )
                    .all()
                )
                for txn in pendings:
                    oid = txn.payment_id
                    last = _last_checked.get(oid, 0)
                    if time.time() - last < 600:      # 同一单 10 分钟内不重复查
                        continue
                    _last_checked[oid] = time.time()
                    st = _xorpay_query_order(oid)
                    if st not in ("payed", "success"):
                        continue
                    # 原子更新：只有「仍为 pending」才处理，防止回调/多 worker 并发重复到账
                    res = db.execute(
                        update(Transaction)
                        .where(Transaction.id == txn.id, Transaction.status == "pending")
                        .values(status="completed")
                    )
                    if res.rowcount == 1:
                        user = db.query(User).filter(User.id == txn.user_id).first()
                        if user:
                            user.token_balance += txn.token_amount
                            user.total_recharged += txn.amount
                            user.updated_at = now
                db.commit()
            finally:
                db.close()
        except Exception:
            pass
        await asyncio.sleep(300)


class RechargeReq(BaseModel):
    package: str = ""          # 固定套餐（兼容）
    payment_method: str = "alipay"
    amount: float = 0          # 自由充值金额（元）


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
    # 自由充值：传 amount 按 1 元 = 100 token；否则按固定套餐（兼容）
    if req.amount and req.amount > 0:
        price = round(float(req.amount), 2)
        if price < MIN_RECHARGE_CNY:
            return {"success": False, "message": f"最低充值 ¥{MIN_RECHARGE_CNY:g}"}
        if price > MAX_RECHARGE_CNY:
            return {"success": False, "message": f"单次最高充值 ¥{MAX_RECHARGE_CNY:g}"}
        tokens = int(price * 100)
        label = f"自由充值 ¥{price:g}"
        desc = label
    else:
        pkg = PACKAGES.get(req.package)
        if not pkg:
            return {"success": False, "message": "请选择充值金额或套餐"}
        price = pkg["price"]
        tokens = pkg["tokens"]
        label = pkg["label"]
        desc = f"{pkg['label']} ¥{pkg['price']:g}"

    # XorPay 支付宝个人商户单笔限额：超限直接拒绝，避免生成无法支付的二维码
    if PAY_CHANNEL == "xorpay" and req.payment_method == "alipay" and price > XORPAY_ALIPAY_MAX:
        return {"success": False, "message": f"支付宝单笔限额 ¥{XORPAY_ALIPAY_MAX:g}，请分笔充值或使用微信支付"}

    order_id = f"TK{uuid.uuid4().hex[:12].upper()}"

    # Save order
    txn = Transaction(
        user_id=user.id,
        amount=price,
        token_amount=tokens,
        type="recharge",
        status="pending",
        payment_method=req.payment_method,
        payment_id=order_id,
        description=desc,
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
            "pay_amount": price,
            "package": {"label": label, "price": price, "tokens": tokens},
            "channel": "manual",
            "note": "请扫码付款后，在订单页面点击「我已付款」等待确认",
        }

    # ── PayJS（仅微信支付） ──
    if PAY_CHANNEL == "payjs" and PAYJS_MCHID and PAYJS_KEY:
        try:
            pay_data = {
                "mchid": PAYJS_MCHID,
                "total_fee": int(price * 100),  # 单位：分
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
                        "pay_amount": price,
                        "package": {"label": label, "price": price, "tokens": tokens},
                        "channel": "payjs",
                    }
                else:
                    txn.status = "failed"
                    db.commit()
                    return {"success": False, "message": result.get("return_msg", "PayJS error")}
        except Exception as e:
            txn.status = "failed"
            db.commit()
            return {"success": False, "message": f"PayJS error: {str(e)}"}


    # ── XorPay（微信NATIVE / 支付宝当面付） ──
    if PAY_CHANNEL == "xorpay" and XORPAY_AID and XORPAY_APP_SECRET:
        try:
            pay_type = "native" if req.payment_method == "wechat" else "alipay"
            name = f"TokUp {label}"
            _pay_price = f"{price:.2f}"

            sign = xorpay_sign(name, pay_type, _pay_price, order_id, notify_url, XORPAY_APP_SECRET)

            pay_data = {
                "name": name,
                "pay_type": pay_type,
                "price": _pay_price,
                "order_id": order_id,
                "notify_url": notify_url,
                "expire": 300,  # 与前端「二维码有效期 5 分钟」文案一致（XorPay 默认 7200 秒）
                "sign": sign,
            }

            # XorPay 偶发网络抖动：下单失败自动重试一次；成功/失败处理放在循环外
            result = None
            for _attempt in range(2):
                try:
                    async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=5.0)) as client:
                        resp = await client.post(
                            f"{XORPAY_API_URL}/{XORPAY_AID}",
                            data=pay_data,
                            headers={"Content-Type": "application/x-www-form-urlencoded"},
                        )
                        result = resp.json() or {}
                    break
                except Exception as _e:
                    if _attempt == 1:
                        raise
                    await asyncio.sleep(1)

            if result.get("status") == "ok" and "info" in result:
                qr_content = result["info"].get("qr", "")
                aoid = result["info"].get("aoid", "")

                # Generate QR as base64 data URL (no file system dependency)
                pay_url = ""
                if qr_content:
                    try:
                        import qrcode as _qr
                        import io as _io
                        import base64 as _b64
                        img = _qr.make(qr_content, box_size=8, border=2)
                        buf = _io.BytesIO()
                        img.save(buf, format="PNG")
                        b64 = _b64.b64encode(buf.getvalue()).decode()
                        pay_url = f"data:image/png;base64,{b64}"
                    except:
                        pay_url = qr_content

                return {
                    "success": True,
                    "order_id": order_id,
                    "pay_url": pay_url,
                    "pay_amount": price,
                    "package": {"label": label, "price": price, "tokens": tokens},
                    "channel": "xorpay",
                    "aoid": aoid,
                }
            else:
                status = result.get("status", "XorPay error")
                msg = result.get("info", "") if isinstance(result.get("info"), str) else ""
                txn.status = "failed"
                db.commit()
                return {"success": False, "message": f"{status}: {msg}"}
        except Exception as e:
            txn.status = "failed"
            db.commit()
            return {"success": False, "message": f"XorPay error: {str(e)}"}

    # ── 自定义支付渠道 ──
    if PAY_CHANNEL == "custom" and CUSTOM_API_URL and CUSTOM_APP_ID and CUSTOM_APP_KEY:
        try:
            pay_data = {
                "app_id": CUSTOM_APP_ID,
                "order_id": order_id,
                "amount": price,
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
                        "pay_amount": price,
                        "package": {"label": label, "price": price, "tokens": tokens},
                        "channel": "custom",
                    }
                txn.status = "failed"
                db.commit()
                return {"success": False, "message": result.get("msg", "Gateway error")}
        except Exception as e:
            txn.status = "failed"
            db.commit()
            return {"success": False, "message": f"Custom payment error: {str(e)}"}

    # ── 支付渠道未配置：禁止回落到 mock，避免给用户假二维码 ──
    if PAY_CHANNEL != "mock":
        txn.status = "failed"
        db.commit()
        return {"success": False, "message": f"支付渠道 {PAY_CHANNEL} 未正确配置，请联系管理员"}

    # ── Mock 模式 ──
    mock_url = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=tokup-{order_id}"
    return {
        "success": True,
        "order_id": order_id,
        "pay_url": mock_url,
        "pay_amount": price,
        "package": {"label": label, "price": price, "tokens": tokens},
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
            # 实付金额校验：低于订单金额不补账（防低价支付骗 token），仅记录待人工处理
            try:
                paid = float(pay_price)
            except Exception:
                paid = 0.0
            if paid + 0.005 < (txn.amount or 0):
                import logging
                logging.getLogger("tokup.payment").warning(
                    "XorPay 实付低于订单金额，不补账: order=%s paid=%s expect=%s",
                    xorpay_order_id, paid, txn.amount,
                )
                return {"code": 1, "msg": "success"}
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
    """管理员确认收款（已禁止用户自助确认，防止未支付直接到账）"""
    from fastapi import HTTPException
    from datetime import datetime, timezone

    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

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


