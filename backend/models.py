import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


def _uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    nickname = Column(String, default="")
    token_balance = Column(Float, default=0.0)  # 单位：分（人民币）
    total_recharged = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    auto_topup_threshold = Column(Float, default=0)  # 0 = disabled
    auto_topup_amount = Column(Float, default=50)  # yuan
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    transactions = relationship("Transaction", back_populates="user")
    api_keys = relationship("ApiKey", back_populates="user")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)  # 金额（分）
    token_amount = Column(Float, nullable=False)  # token 数量（分）
    type = Column(String, nullable=False)  # "recharge" | "consume" | "refund"
    status = Column(String, default="pending")  # "pending" | "completed" | "failed"
    payment_method = Column(String, default="")  # "alipay" | "wechat"
    payment_id = Column(String, default="")  # 第三方支付流水号
    description = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="transactions")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="Default Key")
    is_active = Column(Boolean, default=True)
    rate_limit = Column(Integer, default=60)  # requests per minute
    monthly_cap = Column(Float, default=0)  # 0 = unlimited
    daily_cap = Column(Float, default=0)  # 0 = unlimited
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="api_keys")
