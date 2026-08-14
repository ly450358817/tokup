import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../utils/api';

export default function TermsNoticePopup() {
  const { user, refreshUser } = useAuth();
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);

  // 仅对"老用户"（未确认新版协议，terms_version 为空）且已登录时弹出
  if (!user || user.terms_version) return null;
  if (!show) return null;

  const accept = async () => {
    setBusy(true);
    try {
      await authApi.acceptTerms();
      await refreshUser();
    } catch {
      // 网络异常也允许关闭（后端未记录时下次登录会再弹）
    } finally {
      setBusy(false);
      setShow(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-md backdrop-blur-xl bg-[#15151F] border border-white/[0.08] rounded-2xl p-6">
        <h3 className="text-white font-semibold text-[15px] mb-3">服务协议与隐私政策更新</h3>
        <p className="text-white/60 text-[13px] leading-relaxed mb-5">
          我们已更新《用户服务协议》与《隐私政策》。继续使用本服务即表示您已阅读并同意更新后的协议与隐私政策。
        </p>
        <div className="flex items-center justify-between gap-3">
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 text-[12px] underline hover:text-emerald-300"
          >
            查看完整条款
          </a>
          <button
            onClick={accept}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] hover:bg-emerald-500/20 transition-all disabled:opacity-50"
          >
            {busy ? '提交中...' : '我已阅读并同意'}
          </button>
        </div>
      </div>
    </div>
  );
}
