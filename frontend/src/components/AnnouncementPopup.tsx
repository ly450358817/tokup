import { useState, useEffect } from 'react';

export default function AnnouncementPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('tokup_announcement_dismissed_v5');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      const now = Date.now();
      const fiveDays = 5 * 24 * 60 * 60 * 1000;
      if (now - dismissedAt < fiveDays) return;
    }
    const hasSeenSession = sessionStorage.getItem('tokup_announcement_seen');
    if (hasSeenSession) return;
    sessionStorage.setItem('tokup_announcement_seen', '1');
    setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem('tokup_announcement_dismissed_v5', Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.3s ease' }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
      <div className="bg-[#1C1C26] border border-white/[0.08] rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 mx-auto">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-[18px] font-semibold text-white text-center mb-3">模型调整通知</h2>
        <div className="text-[13px] text-white/50 leading-relaxed space-y-2 mb-6">
          <p>尊敬的 Tokup·脉充用户，您好：</p>
          <p>🔧 <span className="text-white/80 font-medium">模型服务调整通知</span></p>
          <p>因上游渠道调整，以下模型已暂时下架：</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><span className="text-red-400 font-medium">GPT-4o</span></li>
            <li><span className="text-red-400 font-medium">GPT-4o-mini</span></li>
            <li><span className="text-red-400 font-medium">GPT-4 Turbo</span></li>
          </ul>
          <p className="text-white/40 text-[11px]">建议使用 GPT-5.5 或 GPT-5.6 系列替代，体验更好；上游恢复后会第一时间重新上架。</p>
          <div className="border-t border-white/[0.06] pt-2 mt-2">
            <p className="text-white/40 text-[11px]">📢 deepseek-v3.1 已于 2026-08-04 退役，请迁移至 V4 Flash 或 V3.2。</p>
          </div>
          <p className="text-white/40 text-[12px] pt-2">Tokup·脉充 AI 大模型推理团队</p>
        </div>
        <button
          onClick={dismiss}
          className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-[13px] font-medium hover:bg-emerald-400 transition-all"
        >
          我知道了
        </button>
      </div>
    </div>
  );
}
