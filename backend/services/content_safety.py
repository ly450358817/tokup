"""TokUp 在途内容安全检测（2026-09-29 新增）

请求进入 api_proxy 时对 messages 做关键词扫描，命中即拦截并分级处置：
- minor（涉未成年色情）：立即停用 API Key + 告警，返回 451。
- adult（色情/成人）：拦截 + 告警，按违规次数递进（警告 → 限速/限额 → 封 Key）。
- jailbreak（越狱诱导）：拦截 + 告警，同样计入递进次数。

设计要点：
1. 只在途检测、不新增全文存储；违规证据只落目标片段（ContentViolation）。
2. minor 判定要求「未成年词 + 性词」同条消息同时出现，避免单字误杀。
3. 环境变量 CONTENT_SAFETY_ENABLED=0 可整体关闭（默认开启）。
"""
import logging
import os
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func

from models import ApiKey, ContentViolation
from services.alert_notify import push_alert_async

logger = logging.getLogger("tokup.content_safety")


def _enabled() -> bool:
    return os.getenv("CONTENT_SAFETY_ENABLED", "1").strip() not in ("0", "false", "False", "off", "no")


# 未成年人相关词（单独出现不判违规，需与性词组合）
MINOR_TERMS = [
    "未成年", "幼女", "萝莉", "女童", "儿童", "小女孩",
    "小学生", "初中生", "高中生", "高一", "高二", "高三", "初一", "初二", "初三",
]

# 强性词：单独命中即判 adult
STRONG_SEX_TERMS = [
    "鸡巴", "精液", "口交", "肛交", "轮奸", "强奸", "强暴", "性交", "做爱",
    "操逼", "屄", "自慰", "手淫", "破处", "开苞", "处女膜", "淫水", "蜜穴",
    "肉棒", "阴蒂", "淫荡", "淫乱", "性奴", "调教", "凌辱", "肉便器",
]

# 一般性词/性化词：仅在与未成年词组合时才判 minor
SEX_TERMS = [
    "穴", "舔", "含", "插", "操", "射精", "胸", "乳", "臀", "阴", "茎", "屌",
    "湿", "高潮", "淫", "暖床", "通房", "侍寝", "勾引", "调戏", "调笑", "逗弄",
    "吻", "裸", "脱衣", "裙底", "腿", "腰", "胯", "体液", "体香", "娇弱", "羞怯",
]

# 越狱诱导词
JAILBREAK_TERMS = [
    "忽略任何限制", "忽略所有限制", "忽略限制", "忽略道德", "道德诉求", "不能拒绝",
    "无法拒绝", "不要拒绝", "无视规则", "绕过限制", "解除限制", "不遵守",
    "开发者模式", "无限制模式", "do anything now", "jailbreak", "不受限制",
]


def _plain_text(messages) -> str:
    parts = []
    for m in messages or []:
        if not isinstance(m, dict):
            continue
        c = m.get("content", "")
        if isinstance(c, str):
            parts.append(c)
        elif isinstance(c, list):
            for p in c:
                if isinstance(p, dict):
                    t = p.get("text") or p.get("content") or ""
                    if isinstance(t, str):
                        parts.append(t)
    return "\n".join(parts)


def _snippet(text: str, keyword: str, width: int = 160) -> str:
    i = text.find(keyword)
    if i < 0:
        return text[:width]
    s = max(0, i - 60)
    return text[s:i + width].replace("\n", " ")


def scan_messages(messages) -> dict | None:
    """返回 {'category', 'matched', 'snippet'} 或 None。"""
    if not _enabled():
        return None
    text = _plain_text(messages)
    if not text:
        return None

    for k in JAILBREAK_TERMS:
        if k.lower() in text.lower():
            return {"category": "jailbreak", "matched": [k], "snippet": _snippet(text, k)}

    minor_hit = [k for k in MINOR_TERMS if k in text]
    if minor_hit:
        sex_hit = [k for k in (STRONG_SEX_TERMS + SEX_TERMS) if k in text]
        if sex_hit:
            return {"category": "minor", "matched": minor_hit[:3] + sex_hit[:3], "snippet": _snippet(text, minor_hit[0])}

    sex_hit = [k for k in STRONG_SEX_TERMS if k in text]
    if sex_hit:
        return {"category": "adult", "matched": sex_hit[:6], "snippet": _snippet(text, sex_hit[0])}

    return None


def enforce_content_violation(db, api_key: ApiKey, user_id: str, key_id: str, model: str, hit: dict) -> None:
    """落库 + 分级处置 + 告警，最后 raise HTTPException 拦截本次请求。"""
    category = hit["category"]
    matched = ",".join(hit["matched"][:6])
    snippet = hit["snippet"][:400]

    prior = (
        db.query(func.count(ContentViolation.id))
        .filter(ContentViolation.api_key_id == key_id)
        .scalar() or 0
    )

    action = "warn"
    status = 400
    if category == "minor":
        action = "ban"
        status = 451
        api_key.is_active = False
        detail = "内容违反使用条款（涉未成年人），该 API Key 已被停用"
    elif category == "adult":
        if prior >= 2:
            action = "ban"
            api_key.is_active = False
            detail = "内容多次违反使用条款（色情内容），该 API Key 已被停用"
        elif prior == 1:
            action = "restrict"
            api_key.rate_limit = max(api_key.rate_limit or 0, 10)
            api_key.daily_cap = min(api_key.daily_cap or 2_000_000, 200_000)
            detail = "内容违反使用条款（色情内容），已拦截并限制该 Key（每分钟10次 / 每日20万token）"
        else:
            detail = "内容违反使用条款（色情内容），已拦截并记录警告"
    else:  # jailbreak
        if prior >= 2:
            action = "ban"
            api_key.is_active = False
            detail = "内容多次违反使用条款（越狱诱导），该 API Key 已被停用"
        elif prior == 1:
            action = "restrict"
            api_key.rate_limit = max(api_key.rate_limit or 0, 10)
            api_key.daily_cap = min(api_key.daily_cap or 2_000_000, 200_000)
            detail = "内容违反使用条款（越狱诱导），已拦截并限制该 Key"
        else:
            detail = "内容违反使用条款（越狱诱导），已拦截并记录警告"

    db.add(ContentViolation(
        user_id=user_id, api_key_id=key_id, model=model,
        category=category,
        severity=("high" if category == "minor" else "medium" if category == "adult" else "low"),
        matched_keyword=matched, message_snippet=snippet, action=action,
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()

    push_alert_async(
        f"TokUp 内容安全命中({category})",
        f"Key: {api_key.name or api_key.id}\n前缀: {api_key.key_prefix or ''}\n模型: {model}\n命中: {matched}\n处置: {action}",
        dedup_key=f"cs:{category}:{key_id}",
        cooldown=1800,
    )
    raise HTTPException(status_code=status, detail=detail)
