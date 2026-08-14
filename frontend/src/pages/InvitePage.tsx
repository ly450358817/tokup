import { useState, useEffect } from 'react';
import { Gift, Copy, Users, Check, ExternalLink } from 'lucide-react';

export default function InvitePage() {
  const [info, setInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('tokup_token');
    if (!token) return;
    fetch('/api/invite/info', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(() => {});
  }, []);

  const handleCopy = () => {
    if (info?.invite_link) {
      navigator.clipboard.writeText(info.invite_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-[20px] font-semibold text-white">邀请好友</h1>
        <p className="text-[12px] text-white/30 mt-1">邀请好友注册，最高得 500 Token 奖励</p>
      </div>

      {/* 邀请奖励规则 */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">奖励规则</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center px-4 py-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Gift size={18} className="text-emerald-400" />
            </div>
            <p className="text-[13px] text-white/70 font-medium">你邀请好友</p>
            <p className="text-[11px] text-white/40 mt-1">分享你的邀请链接给好友</p>
          </div>
          <div className="text-center px-4 py-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Users size={18} className="text-emerald-400" />
            </div>
            <p className="text-[13px] text-white/70 font-medium">好友注册</p>
            <p className="text-[11px] text-white/40 mt-1">好友使用你的邀请码注册</p>
          </div>
          <div className="text-center px-4 py-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Gift size={18} className="text-emerald-400" />
            </div>
            <p className="text-[13px] text-white/70 font-medium">你得 Token</p>
            <p className="text-[11px] text-white/40 mt-1">好友注册成功，你得 100</p>
          </div>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="relative z-10 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
        <p className="text-[11px] text-amber-400/70 leading-relaxed">
          💡 邀请奖励规则：
          你需累计充值满 ¥50，才可获得邀请奖励（每人最多 5 次固定奖励，每次 +100 Token）。好友消费时，你额外获得其消费额 10% 的 Token 分成，不限次数。
        </p>
      </div>

      {/* 我的邀请 */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-[13px] font-medium text-white/70 mb-4">我的邀请</h3>
        {info ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02]">
              <span className="text-[12px] text-white/50">已邀请好友</span>
              <span className="text-[18px] font-bold text-white">{info.invite_count} 人</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02]">
              <span className="text-[12px] text-white/50">累计奖励</span>
              <span className="text-[18px] font-bold text-emerald-400">¥{(info.invite_bonus / 100).toFixed(0)}</span>
            </div>
            <div>
              <p className="text-[11px] text-white/40 mb-2">你的邀请链接</p>
              <div className="flex items-center gap-2">
                <input readOnly value={info.invite_link}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[12px] text-white/60 font-mono outline-none" />
                <button onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] hover:bg-emerald-500/15 transition-all whitespace-nowrap">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/30 text-xs text-center py-6">加载中...</p>
        )}
      </div>
    </div>
  );
}
