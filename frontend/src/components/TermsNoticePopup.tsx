import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../utils/api';

export default function TermsNoticePopup() {
  const { user, refreshUser } = useAuth();
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);

  // V1.1 协议发布后，未确认 v2 的用户都需要重新确认
  if (!user || user.terms_version === 'v2') return null;
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
          我们已更新至 V1.1，新增海外模型、跨境数据处理、上游模型变更和模型可用性说明，并根据上游实际账单校准部分模型价格。请阅读更新后的《用户服务协议》与《隐私政策》；确认后继续使用。
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
