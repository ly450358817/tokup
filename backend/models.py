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
    token_balance = Column(Float, default=0.0)  # 单位：token（1 元 = 100 token）
    total_recharged = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    invite_code = Column(String, unique=True, nullable=True, index=True)
    referred_by = Column(String, ForeignKey("users.id"), nullable=True)
    invite_count = Column(Integer, default=0)
    paid_invite_count = Column(Integer, default=0)
    auto_topup_threshold = Column(Float, default=0)  # 0 = disabled
    auto_topup_amount = Column(Float, default=50)  # yuan
    ip_address = Column(String, default="", index=True)  # 注册 IP（用于每 IP 注册限流/审计）
    terms_version = Column(String, default="")  # 用户同意的协议版本（v1=含对话存档告知的新版协议，空=老用户未确认）
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    transactions = relationship("Transaction", back_populates="user")
    api_keys = relationship("ApiKey", back_populates="user")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)  # 金额（元）
    token_amount = Column(Float, nullable=False)  # token 数量
    type = Column(String, nullable=False)  # "recharge" | "consume" | "refund"
    status = Column(String, default="pending")  # "pending" | "completed" | "failed"
    payment_method = Column(String, default="")  # "alipay" | "wechat"
    payment_id = Column(String, default="")  # 第三方支付流水号
    description = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="transactions")


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    api_key_id = Column(String, ForeignKey("api_keys.id"), nullable=True)
    model = Column(String, nullable=False)
    provider = Column(String, default="")  # "openai" | "anthropic" | "deepseek"
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_cny = Column(Float, default=0.0)  # 费用（元）
    latency_ms = Column(Integer, default=0)  # 响应时间（毫秒）
    status = Column(String, default="success")  # "success" | "error"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User")
    api_key = relationship("ApiKey")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="Default Key")
    is_active = Column(Boolean, default=True)
    rate_limit = Column(Integer, default=0)  # 每分钟请求上限（0=不限；用户显式设置后才生效）
    monthly_cap = Column(Float, default=0)  # 0 = unlimited
    daily_cap = Column(Float, default=0)  # 0 = unlimited
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="api_keys")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    plan_id = Column(String, nullable=False)
    plan_label = Column(String, default="")
    daily_limit = Column(Float, default=0)
    is_active = Column(Boolean, default=True)
    start_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class ConversationLog(Base):
    """对话全量存档：记录每次 API 调用的请求消息与响应内容（以备不时之需，不自动清理）"""
    __tablename__ = "conversation_logs"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    api_key_id = Column(String, ForeignKey("api_keys.id"), nullable=True, index=True)
    model = Column(String, nullable=False)
    endpoint = Column(String, default="")  # chat | responses | test
    request_json = Column(Text, default="")  # 请求 messages JSON
    response_json = Column(Text, default="")  # 响应内容 JSON
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost_cny = Column(Float, default=0.0)
    status = Column(String, default="success")  # success | error
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user = relationship("User")
    api_key = relationship("ApiKey")
