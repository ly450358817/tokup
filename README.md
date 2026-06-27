# TokUp · 脉充
### AI API Token 一站式充值管理平台

> 🌐 **官网：https://tokup.net/**
>
> 统一余额 · 多模型混用 · 按量计费 · 即充即用

---

## 这是什么？

**TokUp（脉充）** 是一个面向 AI 开发者的 API Token 充值管理平台。你可以在一个地方管理 GPT-4o、Claude、DeepSeek 等多个模型的调用余额，无需每个平台单独充值。

### 适合谁用？

- 🧑‍💻 AI 应用开发者：统一管理多个 API Key
- 🏢 中小团队：按量计费 + 自动补货
- 🎓 AI 爱好者：低门槛体验各种 AI 模型

---

## 核心功能

| 功能 | 说明 |
|------|------|
| 🔐 **统一登录** | JWT 认证，邮箱注册即用 |
| 📊 **概览仪表盘** | 余额、消耗、请求数、响应时间一目了然 |
| 🔑 **API Key 管理** | 创建/删除/配额限制/批量管理 |
| 💳 **充值系统** | 支付宝/微信支付，秒到账 |
| 🌐 **AI 中转代理** | 统一路由到 GPT-4o / Claude / DeepSeek |
| 📜 **交易记录** | 搜索/筛选/CSV 导出 |
| 🌍 **9 种语言** | 中/英/日/韩/法/德/西/葡/俄 |
| 📈 **实时监控** | 模型性能、请求趋势、延迟指标 |
| 🔒 **安全护盾** | 9 层 AI 驱动安全防御 |
| 🔄 **自动续费** | 余额低于阈值自动充值 |

---

## 快速体验

### 1. 在线使用
直接访问 [tokup.net](https://tokup.net/) 注册即可。

### 2. 本地部署

```bash
git clone https://github.com/ly450358817/tokup.git
cd tokup

# 后端
cd backend
pip install -r requirements.txt
export TOKUP_ADMIN_EMAIL="admin@tokup.io"
export TOKUP_ADMIN_PASSWORD="your-password"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000

# 前端
cd frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`

---

## 支付集成

已内置 **虎皮椒（xmpay）** 支付接口：

```bash
export XMPAY_APP_ID="你的应用ID"
export XMPAY_APP_SECRET="你的应用密钥"
export TOKUP_BASE_URL="https://你的域名.com"
```

不配置时自动使用模拟模式。

---

## 设计理念

- 🎨 **视觉**：Apple Watch Ultra × Revolut 设计语言
- 🌗 **深色主题**：极黑背景 + 能量光环
- ⚡ **性能优先**：API 中转毫秒级响应
- 🔒 **安全至上**：AI 驱动的安全防御

---

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **后端**：Python FastAPI + SQLAlchemy + SQLite
- **支付**：XorPay / PayJS / 码支付
- **部署**：Nginx + Uvicorn + Systemd

---

## 推广 / 友情链接

如果你喜欢这个项目，欢迎：
- ⭐ Star 支持
- 🔗 在博客/社交媒体分享 [tokup.net](https://tokup.net/)
- 🐛 提交 Issue 或 PR

---

## License

MIT
