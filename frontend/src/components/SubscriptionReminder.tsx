import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionApi } from '../utils/api';

type Kind = 'expiring' | 'expired' | 'promo';

// 订阅到期提醒 / 续费召回 / 定向推荐（2026-09-14 新增）
// 只在满足条件时显示；同一类型每天只弹一次（localStorage 按天去重）。
export default function SubscriptionReminder() {
  const { isAuth } = useAuth();
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind | null>(null);
  const [visible, setVisible] = useState(false);
  const [daysAgo, setDaysAgo] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuth) return;
    let alive = true;
    subscriptionApi.status().then((d: any) => {
      if (!alive || !d) return;
      let k: Kind | null = null;
      if (d.expiring_soon) k = 'expiring';
      else if (d.expired_recently) k = 'expired';
      else if (d.can_subscribe && !d.active) k = 'promo';
      if (!k) return;
      const today = new Date().toISOString().slice(0, 10);
      try {
        if (localStorage.getItem(`tokup_sub_reminder_${k}_${today}`)) return;
      } catch { /* 隐私模式忽略 */ }
      setDaysAgo(typeof d.expired_days_ago === 'number' ? d.expired_days_ago : null);
      setKind(k);
      setVisible(true);
    }).catch(() => { /* 静默 */ });
    return () => { alive = false; };
  }, [isAuth]);

  const dismiss = () => {
    if (kind) {
      const today = new Date().toISOString().slice(0, 10);
      try { localStorage.setItem(`tokup_sub_reminder_${kind}_${today}`, '1'); } catch { /* 忽略 */ }
    }
    setVisible(false);
  };

  if (!visible || !kind) return null;

  const cfg = {
    expiring: {
      accent: 'text-amber-300',
      ring: 'border-amber-400/30',
      title: '订阅即将到期',
      desc: '24 小时内到期，续费后继续享每日免费额度 + 全模型 9 折。',
      cta: '立即续费',
    },
    expired: {
      accent: 'text-rose-300',
      ring: 'border-rose-400/30',
      title: '订阅已到期',
      desc: `${daysAgo ? `已到期 ${daysAgo} 天，` : ''}每日免费额度已停止，续费 ¥29.9 继续使用。`,
      cta: '续费订阅',
    },
    promo: {
      accent: 'text-emerald-300',
      ring: 'border-emerald-400/30',
      title: '开通订阅更划算',
      desc: '你已有消费记录：¥29.9/7 天，每天 5 万 Token 免费 + 全模型余额 9 折。',
      cta: '查看订阅',
    },
  }[kind];

  return (
    <div className={`fixed right-4 bottom-4 z-[9998] w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border ${cfg.ring} bg-[#1C1C26]/95 backdrop-blur shadow-2xl p-4`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 text-[13px] font-semibold ${cfg.accent}`}>●</div>
        <div className="flex-1">
          <p className={`text-[13px] font-semibold ${cfg.accent}`}>{cfg.title}</p>
          <p className="text-[12px] text-white/55 mt-1 leading-relaxed">{cfg.desc}</p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => { dismiss(); navigate('/pricing'); }}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[12px] font-medium hover:bg-emerald-400 transition-all"
            >
              {cfg.cta}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/45 text-[12px] hover:text-white/70 hover:bg-white/[0.05] transition-all"
            >
              暂不需要
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="关闭" className="text-white/30 hover:text-white/60 text-[14px] leading-none">×</button>
      </div>
    </div>
  );
}
