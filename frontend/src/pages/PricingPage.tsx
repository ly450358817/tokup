import { useLang } from '../contexts/LanguageContext';
import { Check, Zap, Shield, CreditCard } from 'lucide-react';

const MODELS = [
  { name: 'GPT-4o', provider: 'OpenAI', input: '¥20', output: '¥60' },
  { name: 'GPT-4o-mini', provider: 'OpenAI', input: '¥1.5', output: '¥4.5' },
  { name: 'GPT-4-Turbo', provider: 'OpenAI', input: '¥30', output: '¥60' },
  { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', input: '¥15', output: '¥75' },
  { name: 'Claude 3 Opus', provider: 'Anthropic', input: '¥60', output: '¥180' },
  { name: 'Claude 3 Haiku', provider: 'Anthropic', input: '¥1.5', output: '¥6' },
  { name: 'DeepSeek Chat', provider: 'DeepSeek', input: '¥0.5', output: '¥1' },
  { name: 'DeepSeek Coder', provider: 'DeepSeek', input: '¥0.5', output: '¥1' },
];

const REASONS = ['pricing.reason1', 'pricing.reason2', 'pricing.reason3', 'pricing.reason4'];

export default function PricingPage() {
  const { t } = useLang();
  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-[20px] font-semibold text-white">{tr('pricing.title')}</h1>
        <p className="text-[12px] text-white/30 mt-1">{tr('pricing.desc')}</p>
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
                <td className="px-6 py-4 text-[13px] text-white/80">{m.name}</td>
                <td className="px-6 py-4 text-[12px] text-white/40">{m.provider}</td>
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
