# TokUp · 脉充 — 产品设计文档（定稿）

## 品牌

| 项 | 内容 |
|----|------|
| 英文名 | TokUp |
| 中文名 | 脉充 |
| 域名 | tokup.io |
| Slogan | Up Your AI / 让你的AI能量满格 |
| 品牌定位 | AI API Token 一站式充值管理平台 |
| 目标用户 | 国内AI深度用户：开发者、Codex/Cursor用户、AI创作者 |

## 商业模式

赚取 AI API 调用费的中间差价。用户充值 Token → 调用 GPT-4o/Claude/DeepSeek 等 → 平台按实际使用量结算给 OpenAI → 差额为利润。

**利润来源：**
- 模型混用降低成本（简单任务走 DeepSeek，成本低至 GPT-4o 的 1/20）
- 用户未用完的沉淀 Token
- 批量拿 API 折扣差

## 核心功能

### 1. 汽车仪表盘 UI

首页就是仪表盘风格，不是传统管理后台：

- 中央仪表（Gauge）：实时 Token 余额，指针式
- 速度表/转速表风格：用量趋势
- 指示灯：各模型状态（在线/异常）
- 信息屏：今日消耗、预估剩余天数

### 2. 充值系统

- 支付宝/微信扫码支付（第三方聚合支付）
- Token 包：¥9.9 / ¥29.9 / ¥99 / ¥299
- 自动补货：余额低于阈值自动扣款续充
- 企业月卡 ¥299/月

### 3. API 中转

- 给用户生成专属 API 地址
- 支持 GPT-4o / Claude 3.5 Sonnet / DeepSeek V3 / Gemini
- 统一余额扣费，无需切换
- 智能路由：简单请求走低成本模型

### 4. 用量仪表盘

- 实时用量曲线
- 各模型分别统计
- 日/周/月/自定义周期
- 费用预估

### 5. 多 Key 管理

- 生成多个子 API Key
- 每个 Key 独立限速、独立限额
- 适用于不同工具

### 6. 开源 CLI 工具

GitHub 项目：ai-proxy-switcher
- 一行命令切换所有 AI 工具到 TokUp API
- 自动适配 Codex / Cursor / Claude Code / OpenAI SDK

## 获客策略

不投广告，不运营，纯被动流量：

1. SEO 内容 — 50+ 篇教程自动生成，覆盖"国内GPT充值""API中转"等搜索词
2. AIO — 内容被 ChatGPT/DeepSeek/Kimi 等 AI 搜索结果收录
3. GitHub 开源 — ai-proxy-switcher 工具自然传播
4. Chrome 扩展 — 检测到用户访问 OpenAI 官网时推荐 TokUp
5. 口碑裂变 — 邀请送体验金，全自动

## 技术方案

| 层 | 选型 |
|----|------|
| 前端 | React + Vite + Tailwind CSS（仪表盘 UI） |
| 后端 | Python FastAPI |
| 数据库 | PostgreSQL |
| AI API | OpenAI / Anthropic / DeepSeek 官方 API |
| 支付 | 第三方聚合支付（Payjs / Xorpay 等） |
| 部署 | VPS 海外节点（推荐 Vultr 东京） |
| 域名 | tokup.io |

## 启动资金

最低 ¥350（OpenAI 预存款 $50），服务器第一阶段用免费额度。

## 开发阶段

### Phase 1（第 1-2 周）— MVP 上线
- 仪表盘 UI（汽车仪表盘风格）
- 用户注册/登录
- Token 充值 + 支付接入
- API 中转 + 统一计费
- 基础用量统计

### Phase 2（第 3-4 周）— 增长基建
- 多 Key 管理
- SEO 内容 50 篇
- GitHub 开源工具发布
- 邀请裂变系统
- Chrome 扩展

### Phase 3（第 5-6 周）— 优化
- 企业版（团队管理、子账户）
- iOS/Android App
- 自动补货系统
- 高级数据分析
