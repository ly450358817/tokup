# TokUp · 脉充

<div align="center">

**AI API Token 一站式充值管理平台**

统一余额 · 多模型混用 · 按量计费 · 即充即用 · 合规透明

[🌐 tokup.net](https://tokup.net) · [CLI 工具](#-cli-工具) · [模型列表](https://tokup.net/pricing)

</div>

---

## 这是什么？

TokUp（脉充）是一个面向 AI 开发者的 API Token 充值管理平台。你可以在一个地方管理 GPT-5.5、Claude Fable 5、DeepSeek V4 Pro、Qwen 3.7 Max 等多个模型的 API 调用与余额充值，无需每个平台单独充值。

### 适合谁用？

- 🧑‍💻 **AI 应用开发者** — 统一管理多个 API Key
- 🏢 **中小团队** — 按量计费 + 自动续费
- 🎓 **AI 爱好者** — 低门槛体验各种 AI 模型

## 核心功能

| 功能 | 说明 |
|------|------|
| 🔐 **统一登录** | JWT 认证，邮箱注册即用 |
| 💳 **充值系统** | 支付宝/微信支付，秒到账，注册送 ¥10 体验金 |
| 📊 **消费明细** | 每笔 API 调用逐记录，支持 CSV 导出审计 |
| 🔑 **API Key 管理** | 创建/删除/配额限制/批量管理 |
| 🌐 **AI 中转代理** | 统一路由到 OpenAI · Anthropic · DeepSeek · 通义千问 · 智谱 · 豆包 · Kimi |
| 🔒 **安全护盾** | 9 层 AI 驱动安全防御（SQL 注入/XSS/速率限制等） |
| 📈 **实时监控** | 模型性能、请求趋势、延迟指标 |
| 🛡️ **合规透明** | 数据不截流、模型不缩水、计价透明、可追溯审计 |
| 🤝 **邀请奖励** | 邀请好友注册，双方各得 ¥5 体验金 |

## 🖥️ CLI 工具

TokUp 提供命令行工具，方便开发者快速切换 API 网关：

```bash
# 安装
pip install git+https://github.com/ly450358817/tokup.git#subdirectory=cli

# 查看支持的模型
tokup models

# 获取 OpenAI 兼容配置
tokup switch openai
# → export OPENAI_BASE_URL="https://tokup.net/v1"

# 查询余额（需要填入你的 Token）
tokup balance --token YOUR_TOKEN
```

## 快速开始

### 在线使用
直接访问 [tokup.net](https://tokup.net) 注册即可，注册即送 ¥10 体验金。

### OpenAI SDK 接入（兼容）

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://tokup.net/v1",
    api_key="your_tokup_api_key"  # 在 TokUp 后台创建
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}]
)
```

## 支持模型（19 个）

| 厂商 | 模型 | 价格 (输入/输出 per 1M tokens) |
|------|------|------|
| **OpenAI** | GPT-5.5, GPT-4.1, GPT-4o, GPT-4o-mini, o4-mini | ¥1.5 ~ ¥90 |
| **Anthropic** | Claude Fable 5, Claude 4 Sonnet, Claude 3.5 Sonnet, Haiku | ¥1.5 ~ ¥100 |
| **DeepSeek** | V4 Pro, V4 Flash, V3, R1 | ¥0.3 ~ ¥2.0 |
| **通义千问** | Qwen 3.7 Max, Qwen3 Max, Qwen3 Coder 480B | ¥3.0 ~ ¥15 |
| **智谱AI** | GLM-4.5 | ¥3.0 ~ ¥9.0 |
| **字节跳动** | Doubao Seed 1.6 | ¥1.5 ~ ¥4.5 |
| **月之暗面** | Kimi K2.6 | ¥4.0 ~ ¥12.0 |

完整价格请查看 [订阅页](https://tokup.net/pricing)

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **后端**：Python FastAPI + SQLAlchemy + SQLite
- **支付**：支付宝/微信支付
- **部署**：Nginx + Uvicorn + Systemd
- **上游**：七牛云 Modelink（合规授权）

## 合规声明

- ✅ 数据不截流 — API 消息内容不存储
- ✅ 模型不缩水 — 模型路由公开可审计
- ✅ 计价透明 — 明码标价，逐笔可查
- ✅ 数据保护 — 9 层安全护盾 + HTTPS
- ✅ 可追溯审计 — 消费记录 CSV 导出
- ✅ 合规上游 — DeepSeek 走七牛云合规链路

## License

MIT
