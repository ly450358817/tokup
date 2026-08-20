import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Key, Send, Sparkles, Zap, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [testInput, setTestInput] = useState('你好，介绍一下你自己');
  const [testResponse, setTestResponse] = useState('');
  const [testError, setTestError] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.removeItem('tokup_new_registration');
  }, []);

  const handleTestSend = async () => {
    if (!testInput.trim()) return;
    setTestLoading(true);
    setTestResponse('');
    setTestError('');
    try {
      const token = localStorage.getItem('tokup_token');
      const res = await fetch('/api/v1/test/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-v4-flash',
          messages: [{ role: 'user', content: testInput }],
        }),
      });
      const data = await res.json();
      if (res.ok && data.data?.choices?.[0]?.message?.content) {
        setTestResponse(data.data.choices[0].message.content);
      } else if (data.detail) {
        setTestError(data.detail);
      } else {
        setTestResponse(JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      setTestError(e?.message || '网络错误');
    } finally {
      setTestLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTestSend();
    }
  };

  const steps = [
    {
      icon: <Key size={20} />,
      title: '创建你的第一个 API Key',
      desc: '亲手创建密钥，开启你的 AI 之旅',
      content: (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-white/50 leading-relaxed">
              API Key 是你的专属访问凭证。在<strong className="text-white/70"> API 工作台</strong>一键创建，就像拿到一把钥匙——亲手打开第一扇门，更有仪式感。
            </p>
          </div>
          <button
            onClick={() => navigate('/keys')}
            className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] font-medium hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 group"
          >
            <Key size={14} />
            前往创建 API Key
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
          <div className="text-center">
            <button
              onClick={() => setStep(1)}
              className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
            >
              已有密钥？直接体验 →
            </button>
          </div>
        </div>
      ),
    },
    {
      icon: <Zap size={20} />,
      title: '试试效果',
      desc: '像聊天一样，输入内容就能看到 AI 的回复',
      content: (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你想问的问题..."
              className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70 placeholder-white/20 outline-none focus:border-emerald-500/30 transition-colors"
            />
            <button
              onClick={handleTestSend}
              disabled={testLoading || !testInput.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {testLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              ) : (
                <Send size={12} />
              )}
              发送
            </button>
          </div>
          <p className="text-[10px] text-white/30 leading-relaxed">💡 未充值账号需先充值（¥1 起）才能体验；充值多少用多少，无隐藏赠送。</p>
          {testResponse && (
            <div
              ref={responseRef}
              className="p-3 rounded-xl bg-white/5 border border-white/10 max-h-[200px] overflow-y-auto"
            >
              <div className="text-[11px] text-white/40 mb-2">回复：</div>
              <div className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">
                {testResponse}
              </div>
            </div>
          )}
          {testError && (
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
              <div className="text-[11px] text-red-400">{testError}</div>
            </div>
          )}
          <button
            onClick={() => setStep(2)}
            className="w-full py-2.5 rounded-xl border border-white/10 text-xs text-white/40 hover:bg-white/5 transition-all"
          >
            {testResponse ? '效果不错，下一步 →' : '跳过，去充能 →'}
          </button>
        </div>
      ),
    },
    {
      icon: <Sparkles size={20} />,
      title: '去充能，解锁全部模型',
      desc: '按量付费，用多少扣多少',
      content: (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/5 border border-emerald-500/10 text-center">
            <div className="text-[11px] text-white/40 mb-1">当前余额</div>
            <div className="text-[32px] font-bold text-emerald-400 tracking-tight">
              0 <span className="text-sm font-normal opacity-60">Token</span>
            </div>
            <div className="text-[11px] text-white/30 mt-1">充值后立即开始使用</div>
            <div className="mt-3 text-[11px] text-white/40 leading-relaxed">
              自由充值 · <strong className="text-white/60">¥1</strong> 起充<br />
              1 元 = 100 Token，所有主流模型随充随用<br />
              <span className="text-emerald-400/60">按量计费，充值多少用多少</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/pricing')}
            className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] font-medium hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Zap size={14} />
            去充能
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 rounded-xl border border-white/10 text-xs text-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-1.5"
          >
            先进去看看
            <ArrowRight size={12} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 bg-[#13131D] flex items-center justify-center p-4 z-50">
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full bg-emerald-500/2 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-[420px]">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-white mb-2">快速上手</h1>
          <p className="text-xs text-white/40">3 步开启你的 AI 之旅</p>
        </div>
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i <= step ? 'bg-emerald-400' : 'bg-white/10'} ${i === step ? ' scale-125' : ''}`}
              />
              {i < 2 && <div className={`w-6 h-px ${i < step ? 'bg-emerald-400/30' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-[#12121A] border border-white/10 p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              {steps[step].icon}
            </div>
            <div>
              <div className="text-[13px] font-medium text-white">{steps[step].title}</div>
              <div className="text-[10px] text-white/30">第 {step + 1} 步 / 共 3 步</div>
            </div>
          </div>
          {steps[step].content}
        </div>
        <div className="flex gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs text-white/50 hover:bg-white/5 transition-all"
            >
              上一步
            </button>
          ) : (
            <div className="flex-1" />
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className={`py-2.5 rounded-xl border border-emerald-500/20 text-xs text-emerald-400/70 hover:bg-emerald-500/5 transition-all ${step < 2 ? 'flex-1' : 'w-full'}`}
          >
            跳过，进入主页
          </button>
        </div>
      </div>
    </div>
  );
}
