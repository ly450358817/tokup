import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../../contexts/LanguageContext';

interface Props {
  balance: number;
  balanceYuan: number;
  todayUsage: number;
  todayUsageYuan: number;
  activeKeys: number;
}

export default function EnergyRing({
  balance,
  balanceYuan,
  todayUsage,
  todayUsageYuan,
  activeKeys,
}: Props) {
  const [filled, setFilled] = useState(0);
  const { t } = useLang();
  const radius = 120;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;

  const maxBalance = 500 * 100;
  const ratio = Math.min(balance / maxBalance, 1);
  const offset = circumference * (1 - ratio);

  // Color progression: green -> yellow -> orange -> red (battery gauge style)
  const colors = useMemo(() => {
    const pct = balance / maxBalance;
    if (pct > 0.6)  return { start: '#10B981', mid: '#34D399', end: '#059669', label: t.dashboard.abundant };
    if (pct > 0.3)  return { start: '#F59E0B', mid: '#FBBF24', end: '#D97706', label: t.dashboard.moderate };
    if (pct > 0.1)  return { start: '#F97316', mid: '#FB923C', end: '#EA580C', label: t.dashboard.low };
    return { start: '#EF4444', mid: '#F87171', end: '#DC2626', label: t.dashboard.critical };
  }, [balance, maxBalance]);

  useEffect(() => {
    const timer = setTimeout(() => setFilled(1), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: radius * 2 + 60,
          height: radius * 2 + 60,
          boxShadow: `0 0 ${ratio < 0.1 ? 80 : 40}px ${colors.start}15, 0 0 ${ratio < 0.1 ? 120 : 80}px ${colors.start}08`,
          
        }}
      />

      {/* SVG Energy Ring */}
      <svg
        width={radius * 2 + 40}
        height={radius * 2 + 40}
        className="transform -rotate-90"
      >
        {/* Base ring */}
        <circle
          cx={radius + 20}
          cy={radius + 20}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={strokeWidth}
        />
        {/* Active ring */}
        <circle
          cx={radius + 20}
          cy={radius + 20}
          r={radius}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="ring-breathe"
          strokeDasharray={circumference}
          strokeDashoffset={filled ? offset : circumference}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        {/* Glow overlay */}
        <circle
          cx={radius + 20}
          cy={radius + 20}
          r={radius}
          fill="none"
          stroke={`${colors.start}18`}
          strokeWidth={strokeWidth + 10}
          strokeLinecap="round"
          strokeDasharray={circumference * 0.3}
          strokeDashoffset={filled ? offset + circumference * 0.1 : circumference}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
          filter="url(#glow)"
        />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="50%" stopColor={colors.mid} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Center content */}
      <div className="absolute flex flex-col items-center animate-slide-up">
        <span className="text-[11px] tracking-[0.15em] text-white/30 uppercase font-medium">
          Balance
        </span>
        <span
          className="text-[42px] font-bold tracking-tight mt-1"
          style={{ color: colors.start }}
        >
          ¥{balanceYuan.toFixed(2)}
        </span>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.start, boxShadow: `0 0 6px ${colors.start}80` }} />
            <span className="text-[11px] text-white/30">{colors.label}</span>
          </div>
          <span className="text-white/10">|</span>
          <span className="text-[11px] text-white/30">{activeKeys} Keys</span>
        </div>
      </div>
    </div>
  );
}
