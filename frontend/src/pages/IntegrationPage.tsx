import { MessageSquare, Code2, GraduationCap, Gamepad2, Heart, Video, Zap, ArrowRight, Shield, GitBranch } from 'lucide-react';

const scenarios = [
  {
    icon: MessageSquare,
    title: '智能客服机器人',
    desc: '打造企业级 AI 客服系统，具备多轮对话、情感识别、问题分类和工单处理能力。支持多渠道接入、知识库管理和服务质量监控。',
    color: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Code2,
    title: '智能编程助手',
    desc: 'AI 驱动的代码助手，提供代码补全、错误检测、重构建议和文档生成。支持主流 IDE 和 50+ 编程语言，提升开发效率 3 倍以上。',
    color: 'from-blue-500/20 to-blue-500/5',
    border: 'border-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: GraduationCap,
    title: '个性化学习助手',
    desc: 'AI 驱动的个人学习伙伴，提供课程推荐、学习计划制定、知识点讲解和学习进度跟踪。支持多学科内容和个性化教学方案。',
    color: 'from-purple-500/20 to-purple-500/5',
    border: 'border-purple-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: Gamepad2,
    title: '游戏世界构建',
    desc: '智能游戏世界生成器，自动创建游戏地图、背景故事、角色设定和世界观。为游戏开发者提供创意灵感和素材生成。',
    color: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: Heart,
    title: '虚拟陪伴机器人',
    desc: '具备情感理解能力的 AI 伙伴，支持日常聊天、情感支持、兴趣分享和成长陪伴。为用户提供温暖的数字化陪伴体验。',
    color: 'from-rose-500/20 to-rose-500/5',
    border: 'border-rose-500/20',
    iconColor: 'text-rose-400',
  },
  {
    icon: Video,
    title: 'AI 视频与内容创作',
    desc: 'AI 驱动的视频和内容创作工具，支持脚本生成、视频剪辑、配音配乐和特效制作。帮助创作者高效产出优质内容。',
    color: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
];

const steps = [
  { num: '01', title: '注册账号', desc: '免费注册 TokUp 账号，¥1 起充、随充随用' },
  { num: '02', title: '创建 API Key', desc: '在后台一键生成你的专属 API 密钥' },
  { num: '03', title: '选择模型', desc: '按需选择 GPT、DeepSeek、Claude 等模型' },
  { num: '04', title: '开始调用', desc: '配置客户端或直接调用 API，即刻使用' },
];

const features = [
  { icon: GitBranch, title: 'OpenAI 兼容 API', desc: '完美兼容 OpenAI SDK，一行代码切换' },
  { icon: Shield, title: '多模型统一接口', desc: 'GPT · DeepSeek · Claude · Qwen · Kimi · GLM，一个接口调用所有' },
  { icon: Zap, title: '流式与非流式双支持', desc: '同时支持 SSE 流式传输和普通请求，满足不同场景' },
];

export default function IntegrationPage() {
  return (
    <div className="w-full page-container space-y-10">
      {/* Title */}
      <div>
        <h1 className="text-[22px] font-semibold text-white">应用场景</h1>
        <p className="text-[13px] text-white/30 mt-2 leading-relaxed max-w-2xl">
          基于真实业务场景，帮助你高效判断模型选型策略及接入路径，实现业务价值提升
        </p>
      </div>

      {/* 4 Steps */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Zap size={16} className="text-emerald-400" />
          <h2 className="text-[14px] font-medium text-white/70">四步完成 AI 服务接入</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {steps.map((s, i) => (
            <div key={s.num} className="relative">
              <div className="text-[10px] font-mono font-bold text-emerald-400/60 mb-2">{s.num}</div>
              <h3 className="text-[13px] font-medium text-white/80 mb-1">{s.title}</h3>
              <p className="text-[11px] text-white/40 leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <ArrowRight size={14} className="hidden md:block absolute -right-4 top-2 text-white/10" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scenarios */}
      <div>
        <h2 className="text-[16px] font-medium text-white/80 mb-1">精选场景方案</h2>
        <p className="text-[12px] text-white/30 mb-5">覆盖主流业务需求，开箱即用</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((s) => (
            <div
              key={s.title}
              className={`group backdrop-blur-xl bg-gradient-to-br ${s.color} border ${s.border} rounded-2xl p-5 hover:border-white/20 transition-all duration-300 cursor-pointer`}
            >
              <div className={`w-10 h-10 rounded-xl bg-white/[0.03] border ${s.border} flex items-center justify-center mb-4`}>
                <s.icon size={18} className={s.iconColor} />
              </div>
              <h3 className="text-[13px] font-medium text-white/80 mb-2">{s.title}</h3>
              <p className="text-[11px] text-white/40 leading-relaxed">{s.desc}</p>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] text-emerald-400/60 group-hover:text-emerald-400 transition-colors">
                定制解决方案 <ArrowRight size={11} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compat Protocol */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Shield size={16} className="text-emerald-400" />
          <h2 className="text-[14px] font-medium text-white/70">一站式接入大模型能力</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-[#13131D] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <f.icon size={14} className="text-emerald-400" />
                <h3 className="text-[12px] font-medium text-white/70">{f.title}</h3>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-6">
        <p className="text-[12px] text-white/40 mb-4">还不了解如何配置？查看详细接入指南</p>
        <a
          href="/docs"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] hover:bg-emerald-500/15 transition-all"
        >
          查看接入指南 <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
