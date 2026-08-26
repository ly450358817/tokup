import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LanguageContext';
import { Globe, MessageCircle, Zap, Shield, ExternalLink, Bell, DollarSign, Users } from 'lucide-react';
import { streamTestChat } from '../lib/streamTestChat';
import { useState } from 'react';

export default function SettingsPage() {
  const [showHelp, setShowHelp] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role:string;content:string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedGroup, setCopiedGroup] = useState(false);

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    // 先追加空白的 AI 气泡，流式边生成边填充
    setChatMessages(prev => [...prev, {role:'user', content: msg}, {role:'assistant', content: ''}]);
    setChatLoading(true);
    const setLastAssistant = (content: string) => {
      setChatMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') next[next.length - 1] = { ...last, content };
        return next;
      });
    };
    try {
      const token = localStorage.getItem('tokup_token') || '';
      const result = await streamTestChat({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: msg }],
        token,
        onDelta: (content) => setLastAssistant(content),
      });
      if (result.ok) {
        setLastAssistant(result.content || '抱歉，暂时无法回答。请稍后再试。');
      } else {
        const errDetail = result.error || '服务暂时不可用，请稍后重试。';
        setLastAssistant(errDetail === 'Not authenticated' ? '请先登录后再使用AI客服。' : errDetail);
      }
    } catch (e) {
      const errMsg = e instanceof TypeError ? '网络连接失败，请检查网络后重试。' : '服务暂时不可用，请稍后重试。';
      setLastAssistant(errMsg);
    }
    setChatLoading(false);
  };
  const copyGroupId = async () => {
    try {
      await navigator.clipboard.writeText('1102529130');
      setCopiedGroup(true);
      setTimeout(() => setCopiedGroup(false), 2000);
    } catch (e) {
      window.prompt('请手动复制群号：', '1102529130');
    }
  };
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, lang, setLang, languages } = useLang();

  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };

  return (
    <div className="w-full page-container space-y-8">
      <div>
        <h1 className="text-[20px] font-semibold text-white">{tr('nav.settings')}</h1>
        <p className="text-[12px] text-white/30 mt-1">{tr('settings.preferences')}</p>
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

      {/* 官方交流群（仅设置页，用户指定位置） */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">
          <span className="flex items-center gap-2"><Users size={14} /> 官方交流群</span>
        </h3>
        <div className="flex flex-col items-center gap-4">
          <img
            src="/group-qrcode.jpg"
            alt="TokUp 官方群二维码"
            className="w-[220px] rounded-xl border border-white/[0.08]"
          />
          <div className="text-center">
            <p className="text-[12px] text-white/70 mb-1">QQ 群号：<span className="text-white font-medium">1102529130</span></p>
            <p className="text-[11px] text-white/40 mb-3">扫码或搜索群号加入 · 遇到问题、模型建议、最新公告都在这里（群内仅官方渠道，谨防假冒）</p>
            <button
              onClick={copyGroupId}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-all border ${
                copiedGroup
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/[0.08] text-white/60 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
            >
              {copiedGroup ? '已复制 ✓' : '复制群号'}
            </button>
          </div>
        </div>
      </div>

      {/* Help modal (inside return) */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-[#22222C] border border-white/[0.06] rounded-2xl w-[420px] max-w-[90vw] h-[540px] max-h-[80vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <MessageCircle size={18} className="text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-medium text-white">{tr('settings.aiSupport')}</h3>
                <p className="text-[10px] text-white/30">{tr('settings.aiPowered')}</p>
              </div>
              <button onClick={() => setShowHelp(false)} className="w-7 h-7 rounded-full bg-white/[0.05] flex items-center justify-center text-white/40 hover:text-white/70 text-[14px]">&times;</button>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" id="ai-chat-messages">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle size={32} className="text-emerald-400/30 mb-3" />
                  <p className="text-[12px] text-white/40">{tr('settings.aiNoTickets')}</p>
                  <p className="text-[11px] text-white/20 mt-1">{tr('settings.aiQuestionDesc')}</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className="flex gap-3" style={{flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'}}>
                    <div className={"w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 " + (msg.role === 'user' ? 'bg-white/[0.05] text-white/40' : 'bg-emerald-500/10 text-emerald-400')}>
                      {msg.role === 'user' ? 'U' : 'AI'}
                    </div>
                    <div className={"max-w-[75%] px-4 py-2.5 rounded-2xl text-[12px] leading-relaxed " + (msg.role === 'user' ? 'bg-emerald-500/10 text-white/80' : 'bg-white/[0.04] text-white/60')}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-[11px] text-emerald-400">AI</div>
                  <div className="px-4 py-2.5 rounded-2xl bg-white/[0.04]">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400/50 animate-bounce" style={{animationDelay:'0ms'}} />
                      <div className="w-2 h-2 rounded-full bg-emerald-400/50 animate-bounce" style={{animationDelay:'150ms'}} />
                      <div className="w-2 h-2 rounded-full bg-emerald-400/50 animate-bounce" style={{animationDelay:'300ms'}} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Input */}
            <div className="p-4 border-t border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2 bg-[#13131D] rounded-xl px-4 py-2 border border-white/[0.06]">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  placeholder={tr('settings.aiSupportDesc')}
                  className="flex-1 bg-transparent text-white/70 text-[12px] outline-none placeholder:text-white/20"
                />
                <button
                  onClick={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                  className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {/* Simple SVG send icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
