import { useState, useEffect } from 'react';
import { useLang } from '../contexts/LanguageContext';
import { useRecharge } from '../contexts/RechargeContext';
import { subscriptionApi } from '../utils/api';
import { Check, Loader2 } from 'lucide-react';

const MODELS = [
  { id: 'openai/gpt-5.6-terra', name: 'GPT-5.6 Terra', provider: 'OpenAI', input: '¥18', output: '¥110', badge: 'New', note: '旗舰 Terra' },
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'OpenAI', input: '¥45', output: '¥270', badge: 'Hot', note: '最新旗舰' },
  { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'OpenAI', input: '¥10', output: '¥55', badge: 'New', note: '最新旗舰 Luna' },
  { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'OpenAI', input: '¥45', output: '¥270', badge: 'New', note: '高效推理 Sol' },
  { id: 'anthropic/claude-fable-5', name: 'Claude Fable 5', provider: 'Anthropic', input: '¥90', output: '¥450', badge: 'New', note: '最新 Claude' },
  { id: 'moonshotai/kimi-k3', name: 'Kimi K3', provider: '月之暗面', input: '¥26', output: '¥130', badge: 'Hot', note: '中国开源 · 最新旗舰' },
  { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2.6', provider: '月之暗面', input: '¥9', output: '¥36', badge: '', note: '稳定可靠' },
  { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', input: '¥6 / ¥12', output: '¥18 / ¥36', badge: 'Hot', note: '旗舰模型 · 峰谷计价' },
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'DeepSeek', input: '¥1.5', output: '¥3.0', badge: '', note: '极致性价比' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', input: '¥3.0', output: '¥11.0', badge: '', note: '通用模型' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', input: '¥3.0', output: '¥4.0', badge: 'New', note: '达GPT-5水平' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', input: '¥6.0', output: '¥21.0', badge: '', note: '深度推理' },
  { id: 'qwen/qwen3.7-max', name: 'Qwen 3.7 Max', provider: '通义千问', input: '¥16', output: '¥48', badge: '', note: '通义旗舰' },
  { id: 'qwen/qwen3.8-max', name: 'Qwen3.8 Max', provider: '通义千问', input: '¥16', output: '¥48', badge: 'New', note: '2.4T参数新旗舰' },
  { id: 'glm-5.2', name: 'GLM-5.2', provider: '智谱AI', input: '¥11', output: '¥37', badge: 'New', note: '1M上下文旗舰' },
  { id: 'qwen3.5-397b-a17b', name: 'Qwen3.5 397B', provider: '通义千问', input: '¥4.0', output: '¥24.0', badge: 'New', note: '397B超大杯旗舰' },
  { id: 'MiniMax-M1', name: 'MiniMax M1', provider: 'MiniMax', input: '¥8.0', output: '¥32.0', badge: 'New', note: '顶级推理旗舰' },
  { id: 'minimax/minimax-m3', name: 'MiniMax M3', provider: 'MiniMax', input: '¥6.0', output: '¥24.0', badge: 'New', note: '最新旗舰' },
  { id: 'moonshotai/kimi-k2.7-code', name: 'Kimi K2.7 Code', provider: '月之暗面', input: '¥9', output: '¥36', badge: 'New', note: '代码最强' },
];

const REASONS = ['pricing.reason1', 'pricing.reason2', 'pricing.reason3', 'pricing.reason4'];

export default function PricingPage() {
  const { t } = useLang();
  const { openRecharge } = useRecharge();
  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [subStatus, setSubStatus] = useState<any>(null);
  const [quotaModels, setQuotaModels] = useState<string[]>([]);

  useEffect(() => {
    subscriptionApi.plans().then((data: any) => {
      if (data?.plans) {
        const arr = Object.entries(data.plans).map(([id, p]: [string, any]) => ({ id, ...p }));
        setPlans(arr);
      }
      if (Array.isArray(data?.eligible_models)) {
        const names = (data.eligible_models as string[])
          .filter((id: string) => id !== 'glm-4.6v-flash')  // 内部视觉模型不对外展示
          .map((id: string) => { const m = MODELS.find(x => x.id === id); return m ? m.name : id; });
        setQuotaModels(names);
      }
    }).catch(() => {}).finally(() => setLoadingPlans(false));
    subscriptionApi.status().then((d: any) => setSubStatus(d)).catch(() => {});
  }, []);

  const handlePurchase = async (planId: string) => {
    setBuying(planId);
    setMsg({ type: '', text: '' });
    try {
      const res = await subscriptionApi.purchase(planId);
      if (res.success) {
        setMsg({ type: 'success', text: `订阅开通成功！有效期至 ${new Date(res.expires).toLocaleDateString()}，每日 ${(res.daily_limit || 0).toLocaleString()} Token 免费额度` });
        const d = await subscriptionApi.status();
        setSubStatus(d);
      } else {
        setMsg({ type: 'error', text: res.message || '开通失败' });
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || '';
      if (detail.includes('余额不足')) {
        setMsg({ type: 'error', text: '余额不足，请先充值' });
        setTimeout(() => openRecharge(), 500);
      } else {
        setMsg({ type: 'error', text: detail || '网络错误' });
      }
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="w-full page-container space-y-8">
      <div>
        <h1 className="text-[20px] font-semibold text-white">{tr('pricing.title')}</h1>
        <p className="text-[12px] text-white/30 mt-1">{tr('pricing.desc')}</p>
      </div>

      {/* Message toast */}
      {msg.text && (
        <div className={`px-5 py-3 rounded-xl text-sm ${
          msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {msg.text}
        </div>
      )}

      {/* 我的订阅状态 */}
      {subStatus?.active && (
        <div className="backdrop-blur-xl bg-emerald-500/[0.06] border border-emerald-500/20 rounded-2xl p-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="text-[13px] text-emerald-300 font-medium">我的订阅：{subStatus.plan_label || subStatus.plan}</p>
          <p className="text-[12px] text-white/50">有效期至 {new Date(subStatus.expires_at).toLocaleDateString()}</p>
          <p className="text-[12px] text-white/50">今日配额 {Math.round(subStatus.today_used).toLocaleString()} / {Math.round(subStatus.daily_limit).toLocaleString()} token</p>
          <p className="text-[12px] text-emerald-400/80">剩余 {Math.round(subStatus.today_remaining).toLocaleString()} token 免费</p>
        </div>
      )}

      {/* 自由充值 */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <span className="text-emerald-400 text-[18px] font-bold">¥</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-white">自由充值</p>
            <p className="text-[12px] text-white/40 mt-1">1 元 = 100 Token · 输入任意金额（¥1 ~ ¥5000），余额永久有效、按量计费</p>
            <p className="text-[11px] text-white/30 mt-0.5">参考：一次普通对话 ≈ 1~5 Token ≈ 1~5 分钱</p>
          </div>
          <button
            onClick={openRecharge}
            className="px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all shrink-0"
          >
            去充值
          </button>
        </div>
      </div>

      {/* 订阅套餐（每日免费额度） */}
      <div>
        <h2 className="text-[15px] font-semibold text-white mb-1">订阅套餐（每日免费额度）</h2>
        <p className="text-[12px] text-white/30 mb-2">用余额开通：配额内调用不扣余额，超出后按量计费 · 北京时间 0 点重置</p>
        <p className="text-[11px] text-amber-300/60 mb-1">免费配额仅适用低价模型；GPT-5.5 / Claude 等旗舰模型按余额计费、不消耗免费配额。</p>
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[12px] text-emerald-300/90 leading-relaxed">
          💡 <span className="text-emerald-300 font-medium">高频用户订阅更省</span>：每天最高 40 万 Token 免费额度 + 所有模型余额消费 9 折，月调用量大的用户比按量散充划算。越买越多——月卡每天 30万 / 季卡每天 35万 / 年卡每天 40万（月 ¥99 / 季 ¥199 / 年 ¥499），折合单价逐级更低；额度按日重置不累积，日用量越大越划算。
        </div>
        {quotaModels.length > 0 && (
          <p className="text-[10px] text-white/30 mb-5">当前适用：{quotaModels.join(' / ')}（以实际扣费规则为准）</p>
        )}
        {loadingPlans ? (
          <div className="text-[12px] text-white/30">加载中...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 backdrop-blur-xl bg-white/[0.02] transition-all hover:bg-white/[0.04] ${
                  plan.id === 'monthly' ? 'border-emerald-500/30' : 'border-white/[0.06]'
                }`}
              >
                {plan.id === 'monthly' && (
                  <span className="absolute -top-2.5 right-4 px-3 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-medium rounded-full">
                    推荐
                  </span>
                )}
                <h3 className="text-[16px] font-semibold text-white">{plan.label}</h3>
                <div className="mt-3">
                  <span className="text-[28px] font-bold text-white">¥{(plan.price / 100).toFixed(plan.price % 100 === 0 ? 0 : 1)}</span>
                  <span className="text-[11px] text-white/30 ml-1">
                    {plan.id === 'trial' ? '/7天' : plan.id === 'monthly' ? '/月' : plan.id === 'quarterly' ? '/季' : '/年'}
                  </span>
                </div>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] font-semibold">
                  余额消费 9 折
                </span>
                <p className="text-[12px] text-white/50 mt-2">{plan.desc}</p>
                <div className="mt-4 space-y-2 text-[12px] text-white/50">
                  <p>每日 {plan.daily_limit.toLocaleString()} Token 免费</p>
                  <p>超额按量计费 · 0 点重置</p>
                </div>
                <button
                  onClick={() => handlePurchase(plan.id)}
                  disabled={buying === plan.id}
                  className={`mt-5 w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                    buying === plan.id
                      ? 'bg-emerald-500/5 text-emerald-400/50'
                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {buying === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      处理中...
                    </span>
                  ) : '用余额开通'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pricing table */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-6 py-4 text-[11px] text-white/30 font-medium tracking-[0.05em] uppercase">{tr('pricing.model')}</th>
              <th className="px-6 py-4 text-[11px] text-white/30 font-medium tracking-[0.05em] uppercase">{tr('pricing.provider')}</th>
              <th className="px-6 py-4 text-[11px] text-white/30 font-medium tracking-[0.05em] uppercase">{tr('pricing.input')}</th>
              <th className="px-6 py-4 text-[11px] text-white/30 font-medium tracking-[0.05em] uppercase">{tr('pricing.output')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {MODELS.map((m, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
               <td className="px-6 py-4 text-[13px] text-white/80">{m.name}{m.note ? <span className="ml-2 text-[10px] text-white/30">{m.note}</span> : null}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-white/40">{m.provider}</span>
                    {m.badge && (
                      <span className={"text-[10px] px-1.5 py-0.5 rounded-full border " + (() => {
  const bc = { 'New': 'bg-blue-500/10 border-blue-500/20 text-blue-400', 'Hot': 'bg-amber-500/10 border-amber-500/20 text-amber-400', '上游未接入': 'bg-red-500/10 border-red-500/20 text-red-400', '暂不可用': 'bg-amber-500/10 border-amber-500/20 text-amber-400' };
  return bc[m.badge] || 'bg-gray-500/10 border-gray-500/20 text-gray-400';
})()}>{m.badge}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-[13px] text-white/70">{m.input}</td>
                <td className="px-6 py-4 text-[13px] text-white/70">{m.output}</td>
              </tr>
            ))}
          </tbody>
        </table>
      <p className="px-6 py-3 text-[11px] text-white/35 border-t border-white/[0.06]">DeepSeek V4 Pro 为峰谷计价：斜杠前为闲时价、后为高峰价（高峰时段：每日 9:00–12:00、14:00–18:00 北京时间）；其余模型为一口价。</p>
      </div>

      {/* Why TokUp */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-5">{tr('pricing.why')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REASONS.map((reason, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
              <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-[12px] text-white/60">{tr(reason)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
