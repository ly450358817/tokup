import { useState, useEffect } from 'react';
import { useLang } from '../contexts/LanguageContext';
import { useRecharge } from '../contexts/RechargeContext';
import { subscriptionApi } from '../utils/api';
import { Check, Zap, Shield, CreditCard, Loader2 } from 'lucide-react';

const MODELS = [
  { name: 'GPT-5.5', provider: 'OpenAI', input: '¥30', output: '¥90', badge: 'Hot', note: '最新旗舰' },
  { name: 'GPT-4.1', provider: 'OpenAI', input: '¥15', output: '¥45', badge: '', note: '快速推理' },
  { name: 'GPT-4o', provider: 'OpenAI', input: '¥20', output: '¥60', badge: 'Hot', note: '通用主力' },
  { name: 'GPT-4o-mini', provider: 'OpenAI', input: '¥1.5', output: '¥4.5', badge: '', note: '轻量高效' },
  { name: 'o4-mini', provider: 'OpenAI', input: '¥8', output: '¥24', badge: '', note: '轻量推理' },
  { name: 'Claude Fable 5', provider: 'Anthropic', input: '¥25', output: '¥100', badge: 'New', note: '最新 Claude' },
  { name: 'Claude 4 Sonnet', provider: 'Anthropic', input: '¥20', output: '¥80', badge: 'Hot', note: '最强推理' },
  { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', input: '¥15', output: '¥75', badge: '', note: '稳定可靠' },
  { name: 'Claude 3.5 Haiku', provider: 'Anthropic', input: '¥1.5', output: '¥6', badge: '', note: '快速响应' },
  { name: 'DeepSeek V4 Pro', provider: 'DeepSeek', input: '¥0.8', output: '¥1.6', badge: 'Hot', note: '旗舰模型' },
  { name: 'DeepSeek V4 Flash', provider: 'DeepSeek', input: '¥0.3', output: '¥0.6', badge: '', note: '极致性价比' },
  { name: 'DeepSeek V3', provider: 'DeepSeek', input: '¥0.5', output: '¥1.0', badge: '', note: '通用模型' },
  { name: 'DeepSeek R1', provider: 'DeepSeek', input: '¥1.0', output: '¥2.0', badge: '', note: '深度推理' },
  { name: 'Qwen 3.7 Max', provider: '通义千问', input: '¥5.0', output: '¥15.0', badge: '', note: '通义旗舰' },
  { name: 'Qwen3 Max', provider: '通义千问', input: '¥3.0', output: '¥9.0', badge: '', note: '通义旗舰' },
  { name: 'Qwen3 Coder 480B', provider: '通义千问', input: '¥4.0', output: '¥12.0', badge: '', note: '代码专用' },
  { name: 'GLM-4.5', provider: '智谱AI', input: '¥3.0', output: '¥9.0', badge: '', note: '智谱旗舰' },
  { name: 'Doubao Seed 1.6', provider: '字节跳动', input: '¥1.5', output: '¥4.5', badge: '', note: '豆包旗舰' },
  { name: 'Kimi K2.6', provider: '月之暗面', input: '¥4.0', output: '¥12.0', badge: 'New', note: 'Kimi 最新' },
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
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    subscriptionApi.plans().then((data: any) => {
      if (data?.plans) {
        const arr = Object.entries(data.plans).map(([id, p]: [string, any]) => ({ id, ...p }));
        setPlans(arr);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (planId: string) => {
    setBuying(planId);
    setMsg({ type: '', text: '' });
    try {
      const res = await subscriptionApi.purchase(planId);
      if (res.success) {
        setMsg({ type: 'success', text: `开通成功！有效期至 ${new Date(res.expires).toLocaleDateString()}` });
      } else {
        if (res.message?.includes('余额不足')) {
          setMsg({ type: 'error', text: '余额不足，请先充值' });
          setTimeout(() => openRecharge(), 1500);
        } else {
          setMsg({ type: 'error', text: res.message || '开通失败' });
        }
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e?.response?.data?.detail || '网络错误' });
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

      {/* 汇率展示 */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <span className="text-emerald-400 text-[15px] font-bold">¥</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-white/70">充值汇率</p>
            <p className="text-[11px] text-white/40 mt-0.5">1 元 = 100 Token · 余额消耗以实际 API 调用用量为准</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[20px] font-bold text-emerald-400">1:100</p>
            <p className="text-[10px] text-white/30">元 : Token</p>
          </div>
        </div>
      </div>

      {/* Subscription Plans */}
      {!loading && plans.length > 0 && (
        <div>
          <h2 className="text-[15px] font-semibold text-white mb-5">订阅套餐（每日 Token 配额）</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 backdrop-blur-xl bg-white/[0.02] transition-all hover:bg-white/[0.04] ${
                  plan.id === 'quarterly' ? 'border-emerald-500/30' : 'border-white/[0.06]'
                }`}
              >
                {plan.id === 'quarterly' && (
                  <span className="absolute -top-2.5 right-4 px-3 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-medium rounded-full">
                    推荐
                  </span>
                )}
                <h3 className="text-[16px] font-semibold text-white">{plan.label}</h3>
                <div className="mt-3">
                  <span className="text-[28px] font-bold text-white">¥{((plan.price || 0) / 100).toFixed(0)}</span>
                  <span className="text-[11px] text-white/30 ml-1">
                    {plan.id === 'monthly' ? '/月' : plan.id === 'quarterly' ? '/季' : '/年'}
                  </span>
                </div>
                <p className="text-[12px] text-white/50 mt-1">{plan.desc}</p>
                <div className="mt-4 space-y-2 text-[12px] text-white/50">
                  <p>每日 {plan.daily_limit.toLocaleString()} Token</p>
                  <p>超额按量计费</p>
                  <p>每日额度自动重置</p>
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
                  ) : '立即开通'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
               <td className="px-6 py-4 text-[13px] text-white/80">{m.name}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-white/40">{m.provider}</span>
                    {m.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{m.badge}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-[13px] text-white/70">{m.input}</td>
                <td className="px-6 py-4 text-[13px] text-white/70">{m.output}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
