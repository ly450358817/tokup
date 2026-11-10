import { useState, useEffect } from 'react';

// 公告版本号：内容变更时必须递增，否则已点击「我知道了」的用户 5 天内看不到新版
const VERSION = 'v33';

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
      <div className="bg-[#1C1C26] border border-white/[0.08] rounded-2xl p-6 sm:p-8 max-w-md mx-4 max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 mx-auto">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-[18px] font-semibold text-white text-center mb-3">📢 支付服务公告</h2>
        <div className="text-[13px] text-white/50 leading-relaxed space-y-3 mb-6">
          <p>尊敬的用户，您好：</p>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 space-y-1.5 text-[12px]">
            <p className="text-amber-200 font-medium">① 微信支付通道暂时维护</p>
            <p>近期平台出现异常批量充值与恶意下单行为，微信支付通道触发风控并被暂时限制收款。</p>
            <p>平台正在向微信支付及支付服务商申诉，恢复时间以后续公告为准。</p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2.5 space-y-1.5 text-[12px]">
            <p className="text-emerald-300 font-medium">② 支付宝仍可正常充值</p>
            <p>需要充值的用户请选择<span className="text-white/85 font-medium">支付宝</span>完成支付。微信支付恢复前，请勿选择微信支付。</p>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-3 py-2.5 space-y-1.5 text-[12px]">
            <p className="text-red-300 font-medium">③ 切勿反复充值或取消订单</p>
            <p>请勿短时间反复创建订单、支付后取消、重复扫码付款，或使用多个账号进行测试。</p>
            <p>未支付订单不会自动到账；频繁取消或重复下单可能加重风控，影响微信支付恢复进度。</p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 space-y-1.5 text-[12px]">
            <p className="text-white/85 font-medium">④ 已付款但未到账怎么办</p>
            <p>如付款成功但额度未到账，请保留<span className="text-white/85 font-medium">订单号和支付截图</span>，发送邮件至 support@tokup.net，不要重复支付。</p>
          </div>

          <p>已有余额、API Key、订阅和模型调用均不受影响。</p>
          <p className="text-white/35 text-[11px]">公告日期：2026-11-10</p>
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
