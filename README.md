# TokUp · 脉充

> AI API Token 一站式充值管理平台  
> — 统一余额、多模型混用、按量计费

## ✨ 功能

- 🔐 **登录/注册** — JWT 认证
- 📊 **概览仪表盘** — 余额、今日消耗、请求数、平均响应时间、能量环
- 🔑 **API Key 管理** — 创建/删除/配额限制/批量操作
- 💳 **充值系统** — 支付宝/微信支付（虎皮椒 xmpay 集成）
- 📜 **交易记录** — 搜索/筛选/CSV 导出
- 🌐 **多语言** — 9 种语言支持（中/英/日/韩/法/德/西/葡/俄）
- 📖 **接入指南** — curl/Python/Node.js 代码示例
- 📈 **实时监控** — 模型性能、请求趋势、延迟指标
- 🔒 **安全护盾** — 9 层 AI 驱动安全防御
- 🔄 **自动续费** — 余额低于阈值自动充值
- 🎨 **暗黑高级感 UI** — Apple × Revolut 设计语言

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-org/tokup.git
cd tokup
```

### 2. 后端启动

```bash
cd backend
pip install -r requirements.txt

# 设置管理员账号（必填）
export TOKUP_ADMIN_EMAIL="admin@tokup.io"
export TOKUP_ADMIN_PASSWORD="your-admin-password"

# 启动
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. 前端启动

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:3000

## 💰 接入真实支付

项目已集成 **虎皮椒 (xmpay)** 支付接口。开通后用户即可用支付宝/微信扫码付款。

### 开通步骤

1. 注册 [虎皮椒官网](https://www.xmpay.com/)（个人可注册）
2. 获取 APP_ID 和 APP_SECRET
3. 启动后端时设置环境变量：

```bash
export XMPAY_APP_ID="你的应用ID"
export XMPAY_APP_SECRET="你的应用密钥"
export TOKUP_BASE_URL="https://你的域名.com"
```

### 测试模式

不设置 `XMPAY_APP_ID` 时，支付接口自动使用模拟模式，显示 Mock QR Code。

## 🔧 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `TOKUP_ADMIN_EMAIL` | 管理员邮箱 | 首次启动必填 |
| `TOKUP_ADMIN_PASSWORD` | 管理员密码 | 首次启动必填 |
| `TOKUP_SECRET_KEY` | JWT 密钥 | 可选 |
| `TOKUP_DATABASE_URL` | 数据库连接（默认 SQLite） | 可选 |
| `XMPAY_APP_ID` | 虎皮椒应用 ID | 支付必填 |
| `XMPAY_APP_SECRET` | 虎皮椒应用密钥 | 支付必填 |
| `TOKUP_BASE_URL` | 部署域名 | 支付必填 |
| `OPENAI_API_KEY` | OpenAI 代理 API Key | 代理转发选填 |
| `ANTHROPIC_API_KEY` | Anthropic 代理 API Key | 代理转发选填 |
| `DEEPSEEK_API_KEY` | DeepSeek 代理 API Key | 代理转发选填 |

## 🐳 部署

### 使用 Docker（推荐）

```bash
docker compose up -d
```

### 手动部署

1. 后端部署到服务器
2. 前端 `npm run build` → 用 Nginx 托管 `dist/` 目录
3. 配置域名和 HTTPS

## 🧩 Chrome 插件

项目已含 Chrome 扩展，位于 `chrome-extension/` 目录：

1. 打开 Chrome → `chrome://extensions`
2. 开启"开发者模式"
3. "加载已解压的扩展" → 选择 `chrome-extension/` 目录

## 📊 项目结构

```
tokup/
├── backend/                # FastAPI 后端
│   ├── main.py             # 入口
│   ├── models.py           # 数据模型
│   ├── database.py         # 数据库配置
│   ├── routers/            # 路由
│   │   ├── auth.py         # 登录/注册
│   │   ├── dashboard.py    # 仪表盘
│   │   ├── payment.py      # 支付（虎皮椒）
│   │   ├── keys.py         # API Key 管理
│   │   ├── api_proxy.py    # AI API 代理
│   │   ├── monitor.py      # 实时监控
│   │   ├── security.py     # 安全护盾
│   │   └── settings.py     # 自动续费设置
│   └── services/           # 业务逻辑
├── frontend/               # React + Vite 前端
│   └── src/
│       ├── pages/          # 页面组件
│       ├── components/     # UI 组件
│       ├── contexts/       # React Context
│       ├── i18n/           # 多语言
│       └── utils/          # 工具
├── chrome-extension/       # Chrome 浏览器插件
└── deploy/                 # 部署配置
```

## 🤝 贡献

欢迎 Issue 和 PR！

## 📝 License

MIT
