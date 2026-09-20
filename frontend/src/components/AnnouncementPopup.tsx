import { useState, useEffect } from 'react';

// 公告版本号：内容变更时必须递增，否则已点击「我知道了」的用户 5 天内看不到新版
const VERSION = 'v21';

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
        <h2 className="text-[18px] font-semibold text-white text-center mb-3">🚀 模型与计费规则更新</h2>
        <div className="text-[13px] text-white/50 leading-relaxed space-y-2 mb-6">
          <p>尊敬的 Tokup·脉充用户，您好：</p>
          <p>🎯 <span className="text-white/80 font-medium">上线 GLM-5.3 Flash</span>：1M 上下文、多模态、工具调用，¥1.2 / ¥4.2（每百万 token）。</p>
          <p>🎨 <span className="text-white/80 font-medium">上线 Gemini 3.0 Pro Image</span>：支持文生图、图生图和纯对话。输入 ¥24/M，文本输出 ¥130/M，图片输出 <span className="text-white/80 font-medium">¥1300/M 图片 token</span>。</p>
          <p className="text-white/40 text-[11px]">📎 图片模型按实际图片 token 计费；1K 单图通常约 1120 图片 token，单张约 ¥1.5。2K/4K 和编辑输入会更高，余额不足时无法生成。</p>
          <div className="border-t border-white/[0.06] pt-2 mt-2">
            <p className="text-white/40 text-[11px]">📋 V1.1 用户协议已生效，新增海外模型、跨境处理、上游变更和模型可用性说明。原有三项价格校准继续有效：V4 Flash ¥1.8/¥3.6、GPT-5.5 ¥48/¥288、Claude Fable 5 ¥135/¥750；订阅规则不变。</p>
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
