import { useState, useEffect } from 'react';

export default function AnnouncementPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('tokup_announcement_dismissed_v13');
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
    localStorage.setItem('tokup_announcement_dismissed_v13', Date.now().toString());
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
        <h2 className="text-[18px] font-semibold text-white text-center mb-3">🚀 模型更新公告</h2>
        <div className="text-[13px] text-white/50 leading-relaxed space-y-2 mb-6">
          <p>尊敬的 Tokup·脉充用户，您好：</p>
          <p>🎯 <span className="text-white/80 font-medium">本周新增 3 个模型</span>（已在全部页面同步上线）</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><span className="text-emerald-400 font-medium">Qwen 3.7 Plus</span> — 通义千问高性价比中杯，输入 ¥8 / 输出 ¥32（每百万 token）</li>
            <li><span className="text-emerald-400 font-medium">GLM-5.3</span> — 智谱AI 最新一代旗舰，输入 ¥11 / 输出 ¥37（每百万 token）</li>
            <li><span className="text-emerald-400 font-medium">DeepSeek V4 Flash Vision</span> — 视觉理解实验版，输入 ¥4 / 输出 ¥12（每百万 token）</li>
          </ul>
          <div className="border-t border-white/[0.06] pt-2 mt-2">
            <p className="text-white/40 text-[11px]">📢 说明：DeepSeek V4 Pro 峰谷计价规则不变（高峰 ¥12/¥36，闲时 ¥6/¥18）。DeepSeek V4 Flash Vision 为实验版视觉模型，统一按高峰价计费（¥4/¥12）；图片会按尺寸换算成 token 一并计费。</p>
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
