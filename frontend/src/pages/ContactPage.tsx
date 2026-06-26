import { useLang } from '../contexts/LanguageContext';
import { MessageCircle, Zap, Mail } from 'lucide-react';

export default function ContactPage() {
  const { t } = useLang();
  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-[20px] font-semibold text-white">Contact Support</h1>
        <p className="text-[12px] text-white/30 mt-1">AI-powered support — ask anything</p>
      </div>

      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
          <MessageCircle size={28} className="text-emerald-400" />
        </div>
        <h2 className="text-[18px] font-semibold text-white mb-2">AI-Powered Support</h2>
        <p className="text-[13px] text-white/50 max-w-md mx-auto leading-relaxed">
          TokUp uses an AI assistant for customer support. 
          Simply ask your question in this conversation and you'll get an instant response.
        </p>

        <div className="mt-8 max-w-sm mx-auto space-y-3 text-left">
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <Zap size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] text-white/70">How to use API?</p>
              <p className="text-[11px] text-white/40">Generate a key and use it with any OpenAI-compatible client</p>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <Zap size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] text-white/70">Payment issues?</p>
              <p className="text-[11px] text-white/40">Alipay and WeChat Pay supported. Contact us for help.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <Mail size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] text-white/70">Email</p>
              <p className="text-[11px] text-white/40">support@tokup.io</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
