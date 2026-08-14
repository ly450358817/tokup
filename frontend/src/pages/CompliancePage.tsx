import { Shield, Eye, Database, FileText, Lock, BarChart3, ExternalLink, ShieldCheck, X } from 'lucide-react';

const COMMITMENTS = [
  {
    icon: Eye,
    title: '数据透明可控',
    desc: '对话内容按《用户服务协议》与《隐私政策》留存：仅用于安全、质量、计费与防滥用，仅授权人员可查看，不用于模型训练、不对外提供；留存期限 12 个月，法定要求（交易 3 年 / 日志 6 个月）除外。',
    status: '✅ 已实现',
    detail: 'conversation_logs 仅管理员可查 + 注册协议已明确告知',
  },
  {
    icon: Database,
    title: '模型不缩水',
    desc: '用户选择的模型与实际调用的上游模型严格一致。GPT-5.6 系列就是真正的 OpenAI GPT-5.6，不搞狸猫换太子。',
    status: '✅ 已实现',
    detail: 'MODEL_ROUTES 显式映射，每条路由可公开审计',
  },
  {
    icon: BarChart3,
    title: '计价透明',
    desc: '按模型、按实际 Token 用量计费。每笔请求的 input/output tokens 和费用（元）精确记录，用户可在「消费明细」中逐笔查看。',
    status: '✅ 已实现',
    detail: 'UsageRecord 记录每次请求的 tokens 和费用',
  },
  {
    icon: Shield,
    title: '数据保护',
    desc: '12 层 AI 安全护盾：IP 封禁、速率限制、SQL/XSS/命令注入扫描、NoSQL 注入检测、启发式异常评分、认证失败追踪、人机验证、会话管理、Key 异常检测。所有传输经 Cloudflare HTTPS 加密。',
    status: '✅ 已实现',
    detail: 'security_service.py 作为全局中间件运行',
  },
  {
    icon: FileText,
    title: '可追溯审计',
    desc: '每条 API 调用的模型、Token 用量、费用、响应时间、状态均记录在案。支持 CSV 导出，满足企业内部审计和数据流向追溯需求。',
    status: '✅ 已实现',
    detail: 'GET /api/usage/records + /api/usage/export',
  },
  {
    icon: ShieldCheck,
    title: '账户安全',
    desc: '3 层额外账户保护：Turnstile 人机验证防批量注册、Refresh Token 会话管理（最多 5 个并发）、API Key 异地调用检测（10 分钟内 >3 个 IP 自动告警）。',
    status: '✅ 已实现',
    detail: 'frontend + backend: Turnstile + Sessions + Key Abuse Detection',
  },
  {
    icon: Lock,
    title: '合规上游',
    desc: 'TokUp 对接具有正规授权的 AI 云厂商作为上游，继承上游的合规授权协议。用户数据经合规链路流转，规避灰色中转风险。',
    status: '🔜 接入中',
    detail: '直连 OpenAI → 切换至合规上游 API',
  },
];

export default function CompliancePage() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs mb-6">
          <Shield size={12} />
          合规透明报告
        </div>
        <h1 className="text-[32px] font-bold text-white mb-3">TokUp · 脉充</h1>
        <p className="text-[14px] text-white/40 max-w-xl mx-auto leading-relaxed">
          我们致力于构建透明、可审计、数据安全的 AI API 服务平台。
          以下是 TokUp 在「清朗 AI」行动 6 项合规基线中的实际落地情况。
        </p>
      </div>

      {/* Close button */}
      <div className="flex justify-end -mt-4 mb-2">
        <a
          href="/dashboard"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/[0.06] text-[11px] transition-all"
        >
          <X size={14} />
          返回
        </a>
      </div>

      {/* Compliance Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COMMITMENTS.map((item, i) => (
          <div key={i} className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.03] transition-all">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                <item.icon size={18} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-[15px] font-medium text-white">{item.title}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/30">
                    {item.status}
                  </span>
                </div>
                <p className="text-[13px] text-white/50 leading-relaxed mb-2">{item.desc}</p>
                <code className="text-[11px] text-emerald-400/60 bg-emerald-500/5 px-2 py-1 rounded-md">{item.detail}</code>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Audit CTA */}
      <div className="mt-10 backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-center">
        <p className="text-[13px] text-white/40 mb-4">
          以上声明对应「清朗 AI」专项行动的 6 项合规要求。
          平台已具备完整的审计数据供用户和监管查验。
        </p>
        <a
          href="/usage"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] hover:bg-emerald-500/15 transition-all"
        >
          查看消费明细 <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
