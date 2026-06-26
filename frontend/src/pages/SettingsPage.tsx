import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import { Globe, MessageCircle, Zap, Shield, ExternalLink, Bell, DollarSign, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
  const [showHelp, setShowHelp] = useState(false);
  const { user } = useAuth();
  const { t, lang, setLang, languages } = useLang();

  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-[20px] font-semibold text-white">{tr('nav.settings')}</h1>
        <p className="text-[12px] text-white/30 mt-1">{tr('settings.preferences')}</p>
      </div>

      {/* Theme Toggle */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            Theme
          </span>
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] text-white/70">Dark / Light mode</p>
            <p className="text-[10px] text-white/30 mt-0.5">Switch between dark and light appearance</p>
          </div>
          <button
            onClick={() => {}}
            className="relative w-16 h-8 rounded-full bg-white/[0.08] flex items-center px-1 transition-all"
          >
            <span className="w-6 h-6 rounded-full bg-emerald-400 shadow-sm transition-all translate-x-0"></span>
          </button>
        </div>
      </div>

      {/* Auto Top-up */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2"><RefreshCw size={14} className="text-emerald-400" /> Auto Top-up</span>
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-white/70">Auto recharge when balance is low</p>
              <p className="text-[10px] text-white/30 mt-0.5">We will automatically recharge your account when balance drops below your threshold</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-9 h-5 bg-white/[0.08] rounded-full peer peer-checked:bg-emerald-500/60 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[10px] text-white/30 mb-1.5">Threshold (¥)</p>
              <input type="number" defaultValue="10" className="glass-input w-full" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-white/30 mb-1.5">Recharge amount (¥)</p>
              <input type="number" defaultValue="50" className="glass-input w-full" />
            </div>
          </div>
          <button className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all">Save</button>
        </div>
      </div>

      {/* Language Selection */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2">
            <Globe size={14} /> {tr('lang.title')}
          </span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all border ${
                lang === l.code
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.03]'
              }`}
            >
              <span className="text-base">{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">{tr('settings.about')}</h3>
        <div className="space-y-4 text-[12px] text-white/50 leading-relaxed">
          <p className="text-white/70 text-[13px] font-medium">TokUp · 脉充</p>
          <p>AI API Token 一站式充值管理平台。统一余额、多模型混用、按量计费。</p>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <Zap size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] text-white/70 mb-0.5">{tr('settings.howItWorks')}</p>
              <p className="text-[11px] text-white/40">{tr('settings.howItWorksDesc')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02]">
            <Shield size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] text-white/70 mb-0.5">{tr('settings.supportedModels')}</p>
              <p className="text-[11px] text-white/40">{tr('settings.supportedModelsDesc')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact / AI Support */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2">
            <MessageCircle size={14} />{tr('settings.aiSupport')}
          </span>
        </h3>
        <div className="space-y-3 text-[12px] text-white/50 leading-relaxed">
          <p>{tr('settings.aiSupportDesc')}</p>
          <button
            onClick={() => setShowHelp(true)}
            className="w-full flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left"
          >
            <MessageCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] text-white/70 mb-0.5">{tr('settings.aiNeedHelp')} <span className="text-[11px] text-emerald-400">{tr('settings.aiClickHere')}</span></p>
              <p className="text-[11px] text-white/40">{tr('settings.aiQuestionDesc')}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Help modal (inside return) */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-[#16161E] border border-white/[0.06] rounded-2xl p-6 max-w-sm mx-4 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <MessageCircle size={20} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-[15px] font-medium text-white">{tr('settings.aiSupport')}</h3>
                <p className="text-[10px] text-white/30">{tr('settings.aiPowered')}</p>
              </div>
            </div>
            <p className="text-[12px] text-white/50 leading-relaxed mb-4">{tr('settings.aiSupportDesc')}</p>
            <p className="text-[11px] text-white/30 mb-5">{tr('settings.aiNoTickets')}</p>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all"
            >
              {tr('common.confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
