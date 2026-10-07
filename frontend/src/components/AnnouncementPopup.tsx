import { useState, useEffect } from 'react';

// 公告版本号：内容变更时必须递增，否则已点击「我知道了」的用户 5 天内看不到新版
const VERSION = 'v27';

function safeGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null; // 隐私模式/存储不可用时静默降级，绝不阻断页面
  }
}

function safeSet(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    /* 同上：忽略存储异常 */
  }
}

export default function AnnouncementPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const muted = safeGet(localStorage, `tokup_announcement_muted_${VERSION}`);
    if (muted) return;

    const dismissed = safeGet(localStorage, `tokup_announcement_dismissed_${VERSION}`);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      const now = Date.now();
      const fiveDays = 5 * 24 * 60 * 60 * 1000;
      if (!Number.isNaN(dismissedAt) && now - dismissedAt < fiveDays) return;
    }
    const hasSeenSession = safeGet(sessionStorage, `tokup_announcement_seen_${VERSION}`);
    if (hasSeenSession) return;
    safeSet(sessionStorage, `tokup_announcement_seen_${VERSION}`, '1');
    setVisible(true);
  }, []);

  const dismiss = () => {
    safeSet(localStorage, `tokup_announcement_dismissed_${VERSION}`, Date.now().toString());
    setVisible(false);
  };

  const dismissForVersion = () => {
    safeSet(localStorage, `tokup_announcement_muted_${VERSION}`, '1');
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
        <h2 className="text-[18px] font-semibold text-white text-center mb-3">📢 模型上新与退役通知</h2>
        <div className="text-[13px] text-white/50 leading-relaxed space-y-3 mb-6">
          <p>尊敬的用户，您好：</p>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 space-y-1.5 text-[12px]">
            <p className="text-white/85 font-medium">① Claude Opus 5.5 已上线</p>
            <p>模型 ID：<span className="text-emerald-300/90">claude-opus-5-5</span></p>
            <p>价格：¥36 / ¥180（每百万输入 / 输出 Token）</p>
            <p>定位：旗舰级复杂推理 · 编码 · Agent 任务</p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 space-y-1.5 text-[12px]">
            <p className="text-white/85 font-medium">② 模型退役时间表</p>
            <p>· <span className="text-white/85 font-medium">deepseek-v3</span>：本平台将于 <span className="text-amber-300/90">2026-10-09</span> 起不再提供。</p>
            <p>　建议迁移至 <span className="text-white/85 font-medium">deepseek/deepseek-v4-flash-20260731</span> 或 <span className="text-white/85 font-medium">deepseek/deepseek-v4.1-flash</span>。</p>
            <p>· <span className="text-white/85 font-medium">gemini-2.5-flash</span>、<span className="text-white/85 font-medium">gemini-2.5-pro</span>：本平台将于 <span className="text-amber-300/90">2026-10-20</span> 起不再提供。</p>
            <p>　建议迁移至 <span className="text-white/85 font-medium">deepseek/deepseek-v4-flash</span>（¥1.8 / ¥3.6）或 <span className="text-white/85 font-medium">qwen/qwen3.8-flash-next</span>（¥1.5 / ¥4.0）。</p>
            <p>以上价格单位均为 ¥ / 百万 Token（输入 / 输出）。请在截止日前更换模型 ID。</p>
          </div>

          <p>您的 API Key、余额与订阅均不受影响。</p>
          <p className="text-white/40 text-[12px] pt-1">Tokup·脉充 AI 大模型推理团队</p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-[13px] font-medium hover:bg-emerald-400 transition-all"
          >
            我知道了
          </button>
          <button
            type="button"
            onClick={dismissForVersion}
            title="本次公告不再提示，发布新公告时仍会显示"
            className="w-full py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/45 text-[12px] hover:text-white/70 hover:bg-white/[0.06] transition-all"
          >
            不再提示
          </button>
        </div>
      </div>
    </div>
  );
}
