"""TokUp 在途内容安全检测（2026-09-29 新增）

请求进入 api_proxy 时对 messages 做关键词扫描，命中即拦截本次请求（停止生成/传输），
只覆盖「涉未成年」与「越狱诱导」两类（色情/adult 不再拦截），处置为轻量告警：每次违规仅「拦截本次请求 + 落库 content_violations（审计）+ 发站内告警（user_warnings）」，不自动封 Key。
（虚构文本/关键词误报风险高，真人相关严重内容由人工判断后手动停用。）

设计要点：
1. 不向管理员推送告警（用户要求）；违规记录只被动落库，管理员可事后在后台/DB 查看。
2. 只在途检测、不新增全文存储；违规证据只落命中词 + 目标片段。
3. minor 判定要求「未成年词 + 性词」同条消息同时出现，避免单字误杀。
4. 环境变量 CONTENT_SAFETY_ENABLED=0 可整体关闭（默认开启）。
"""
import logging
import os
from datetime import datetime, timezone

from fastapi import HTTPException

from models import ApiKey, ContentViolation, UserWarning

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

    # 注：2026-09-29 起不再单独拦截「色情/adult」（七牛上游对色情无内容拦截，403 实为欠费），
    # STRONG_SEX_TERMS 仅保留用于「未成年词 + 性词」的 minor 组合判定。
    return None


def _category_label(category: str) -> str:
    return {"minor": "涉未成年人色情", "adult": "色情内容", "jailbreak": "越狱诱导"}.get(category, category)


def enforce_content_violation(db, api_key: ApiKey, user_id: str, key_id: str, model: str, hit: dict) -> None:
    """拦截本次请求 + 站内告警。不自动封 Key：虚构文本/关键词误报风险高，真人相关严重内容由人工判断后手动停用。"""
    category = hit["category"]
    matched = ",".join(hit["matched"][:6])
    snippet = hit["snippet"][:400]
    label = _category_label(category)

    # 同一条未确认告警只发一次，避免刷屏
    existing = (
        db.query(UserWarning.id)
        .filter(UserWarning.user_id == user_id, UserWarning.acknowledged == False)  # noqa: E712
        .first()
    )
    if not existing:
        db.add(UserWarning(
            user_id=user_id, api_key_id=key_id, category=category,
            title="内容安全告警",
            message=f"您的调用内容触发安全策略（{label}），已拦截本次请求。请停止发送违规内容，谢谢配合。",
            acknowledged=False,
            created_at=datetime.now(timezone.utc),
        ))
    detail = f"内容违反使用条款（{label}），已拦截本次请求。"

    db.add(ContentViolation(
        user_id=user_id, api_key_id=key_id, model=model,
        category=category,
        severity=("high" if category == "minor" else "medium" if category == "adult" else "low"),
        matched_keyword=matched, message_snippet=snippet, action="warn",
        created_at=datetime.now(timezone.utc),
    ))
    db.commit()
    raise HTTPException(status_code=451 if category == "minor" else 400, detail=detail)
