import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { contentWarningApi } from '../utils/api';

const CATEGORY_ICON: Record<string, string> = {
  minor: '⛔',
  adult: '🔞',
  jailbreak: '🛡️',
};

export default function ContentWarningPopup() {
  const { isAuth, loading } = useAuth();
  const [warnings, setWarnings] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !isAuth) return;
    let cancelled = false;
    contentWarningApi
      .list()
      .then((d) => {
        if (!cancelled) setWarnings(d?.warnings || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuth, loading]);

  if (!warnings.length) return null;
  const current = warnings[0];

  const acknowledge = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await Promise.all(warnings.map((w) => contentWarningApi.ack(w.id).catch(() => {})));
      setWarnings([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ animation: 'cwFadeIn 0.3s ease' }}>
      <style>{`@keyframes cwFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
      <div className="bg-[#1C1C26] border border-red-500/30 rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4 mx-auto text-xl">
          {CATEGORY_ICON[current.category] || '⚠️'}
        </div>
        <h2 className="text-[18px] font-semibold text-white text-center mb-3">{current.title || '内容安全告警'}</h2>
        <div className="text-[13px] text-white/60 leading-relaxed mb-6 px-1">
          <p>{current.message}</p>
          <p className="text-amber-300/80 mt-3 text-[12px]">再次触发违规内容，您的 API Key 将被停用。</p>
        </div>
        <button
          type="button"
          onClick={acknowledge}
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-red-500 text-white text-[13px] font-medium hover:bg-red-400 transition-all disabled:opacity-60"
        >
          我知道了
        </button>
      </div>
    </div>
  );
}
