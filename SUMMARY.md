# TokUp · 脉充 — 项目摘要

## 一句话
为中国 AI 深度用户提供的一站式 API Token 充值与管理平台。

## 品牌
- 英文名：TokUp（tokup.io）
- 中文名：脉充
- Slogan：Up Your AI
- 定位：国际+中国双市场，高级感设计，卖点是体验不是价格

## 商业模式
赚取 AI API 的中间差价。用户充值 Token → 调用 GPT-4o/Claude/DeepSeek → 平台按实际成本结算 → 差额为利润。

## 核心差异化（vs 22 家竞品）
1. **视觉：能量光环** — 单弧线发光环 + 呼吸动画，不是表格不是仪表盘
2. **品牌：TokUp 脉充** — TikTok 家族感 + 中文意境，竞品没品牌
3. **工具开源自传播** — GitHub CLI 一键切换、Chrome 扩展、SEO 50+ 文章
4. **零运营获客** — 不投广告，靠设计分享 + AIO + SEO + 口碑裂变

## 战略：农村包围城市
不打 AnyRouter（头部），先用审美碾压二线平台（API2D/GPTSAPI/老张中转），建立根据地再向上打。

## 盈利算账
- 启动资金：最低 ¥350（OpenAI 预存款 $50）
- 定价：¥9.9 / ¥29.9 / ¥99 / ¥299
- 利润：5-8 个用户回本，之后纯赚
- 3 个月预期：月流水 ¥1.5-4 万，利润 ¥5-15k

## 技术栈
- 前端：React + Vite + Tailwind CSS + Recharts
- 后端：Python FastAPI + SQLite/PostgreSQL
- 部署：海外 VPS（Vultr 东京）
- 支付：第三方聚合支付（身份证即可开通）

## 当前进度
已完成项目骨架搭建：
- ✅ 后端：FastAPI 主应用 + 数据库模型 + 认证/仪表盘/支付/API代理/Key管理路由
- ✅ 前端：React 项目配置 + 品牌CSS + AuthContext + API工具 + 能量环主组件（SVG动态环+呼吸动画）

## 项目目录结构
```
outputs/tokup/
├── backend/
│   ├── main.py           # FastAPI 入口
│   ├── database.py       # 数据库配置
│   ├── models.py         # User/Transaction/ApiKey 模型
│   ├── requirements.txt
│   ├── services/
│   │   ├── token_service.py    # Token 管理
│   │   └── ai_service.py       # AI API 路由/计费
│   └── routers/
│       ├── auth.py        # 注册/登录
│       ├── dashboard.py   # 仪表盘数据
│       ├── payment.py     # 充值/定价
│       ├── keys.py        # API Key 管理
│       └── api_proxy.py   # AI API 中转代理
├── frontend/
│   ├── package.json / vite.config.ts / tailwind.config.js
│   └── src/
│       ├── index.css      # 品牌样式：暗黑高级感
│       ├── App.tsx        # 路由
│       ├── contexts/
│       │   └── AuthContext.tsx
│       ├── utils/
│       │   └── api.ts     # API 请求封装
│       └── components/
│           └── Energy/
│               └── EnergyRing.tsx  # 能量光环核心组件
└── docs/
    └── specs/
        └── 2026-06-24-tokup-design.md
```

## 下一步待完成
- 登录页 UI
- 仪表盘首页（整合能量环+数据行+模型指示灯+按钮）
- 支付弹窗 + 定价选择
- API Key 管理页面
- 本地运行 + 联调测试
- 部署上线
