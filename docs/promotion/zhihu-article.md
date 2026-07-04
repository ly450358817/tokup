# 2026 年用 AI API 的正确姿势：一个合规中转站的搭建实录

从去年开始接触大模型开发，经历了一段「踩坑—对比—自己动手」的过程，分享一下我的经验。

## 为什么自己搭？

市面上 AI API 中转站很多，但普遍有几个问题：

**1. 模型不透明**
你调用的是 GPT-4o，但实际跑的是什么模型自己不知道。部分中转站靠替换模型赚取差价。

**2. 数据安全存疑**
消息内容经过中转站，对方是否有留存、是否用于训练？你无从知晓。

**3. 计费不清晰**
价格看起来便宜，但实际消耗了多少 Token、怎么算的，用户查不到明细。

**4. 合规问题**
随着网信办「清朗 AI」行动开展，无上游授权的灰色中转站面临越来越大的监管压力。

## 我的解决方案

花了一段时间，基于以下几点重新做了一个平台叫 TokUp（脉充）：

**上游合规**
DeepSeek、通义千问等国产模型通过七牛云 Modelink 接入。七牛云是正规国内云厂商，有完整的合规授权和资质。GPT、Claude 通过官方 API 直连。

**数据不落地**
API 调用只做透传转发，消息内容不写入数据库。调用完即丢弃，没有任何数据留存环节。

**模型透明**
每个模型的路由都公开可查。用户请求 `gpt-4o`，实际调用的就是 OpenAI 的 `gpt-4o`，不存在狸猫换太子。

**计费可审计**
每笔 API 调用的模型、输入 Token 数、输出 Token 数、费用、响应时间都逐条记录。用户可以在后台查看明细，也支持导出 CSV 用于内部审计。

**安全防护**
内置 9 层 AI 安全护盾：SQL 注入扫描、XSS 检测、速率限制、IP 封禁、命令注入检测、异常行为评分等，全部作为中间件在请求入口拦截。

## 支持哪些模型

目前接入 19 个主流模型：

- **OpenAI**：GPT-5.5、GPT-4.1、GPT-4o、GPT-4o-mini、o4-mini
- **Anthropic**：Claude Fable 5、Claude 4 Sonnet、Claude 3.5 Sonnet、Claude 3.5 Haiku
- **DeepSeek**：DeepSeek V4 Pro、V4 Flash、V3、R1
- **通义千问**：Qwen 3.7 Max、Qwen3 Max、Qwen3 Coder 480B
- **智谱**：GLM-4.5
- **字节跳动**：Doubao Seed 1.6
- **月之暗面**：Kimi K2.6

## 怎么用

OpenAI SDK 完全兼容，改一行代码就行：

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://tokup.net/v1",   # 改这个
    api_key="你的 TokUp API Key"        # 换成这个
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "你好"}]
)
```

也支持命令行工具一键切换：

```bash
pip install git+https://github.com/ly450358817/tokup.git#subdirectory=cli
tokup switch openai
```

## 福利

注册就送 ¥10 体验金，不需要绑卡，可以直接试调接口。

如果注册时填邀请码 `XXXX`，可以额外拿 ¥5（欢迎在评论区留言获取邀请码）。

→ https://tokup.net

有什么问题欢迎在评论区交流，我都会回复。
