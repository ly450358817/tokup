import { useState, useEffect } from 'react';

// 公告版本号：内容变更时必须递增，否则已点击「我知道了」的用户 5 天内看不到新版
const VERSION = 'v22';

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
        <h2 className="text-[18px] font-semibold text-white text-center mb-3">📢 上游模型下线提醒</h2>
        <div className="text-[13px] text-white/50 leading-relaxed space-y-2 mb-6">
          <p>尊敬的 Tokup·脉充用户，您好：</p>
          <p>⏰ <span className="text-white/80 font-medium">Claude 4.5 Sonnet 即将退役</span>：上游（七牛云）通知，<span className="text-white/80 font-medium">claude-4.5-sonnet 将于 2026-09-29 正式下线</span>，届时该模型将无法再调用。</p>
          <p>✅ <span className="text-white/80 font-medium">本次下线不影响 Tokup·脉充平台现有服务</span>：我们从未上线 claude-4.5-sonnet，您的 API Key、余额、订阅和正在使用的模型均不受影响，<span className="text-white/80 font-medium">无需做任何操作</span>。</p>
          <p>🔄 <span className="text-white/80 font-medium">若您在其他渠道仍在使用 Claude 4.5 Sonnet</span>，建议尽早迁移，避免 9 月 29 日后调用中断。下方为本站可用的新版 Claude，按需切换即可：</p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 space-y-1 text-[12px]">
            <p><span className="text-white/80 font-medium">claude-4.6-sonnet</span>（旗舰 Sonnet）  ¥ 27 / ¥ 135</p>
            <p><span className="text-white/80 font-medium">claude-4.7-opus</span>（最新旗舰 Opus）  ¥ 45 / ¥ 225</p>
            <p><span className="text-white/80 font-medium">anthropic/claude-fable-5</span>（最新 Claude）  ¥ 135 / ¥ 750</p>
            <p className="text-white/40 text-[11px] pt-1">价格为 ¥ / 百万 Token（输入 / 输出）。上游推荐的 anthropic/claude-sonnet-5 目前尚未上线，如需可联系运营开通评估。</p>
          </div>
          <p className="text-white/40 text-[12px] pt-2">Tokup·脉充 AI 大模型推理团队</p>
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
