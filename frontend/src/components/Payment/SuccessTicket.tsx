import { useEffect, useState } from 'react';

/**
 * SuccessTicket — 充值 / 订阅成功「能量票券」动效
 * 深蓝夜色渐变券面 + 顶部光带 + 扫光 + 大数字滚动 + 入场动画
 * 文案原则：只写真实到账/真实权益，不做虚假“中奖”承诺
 */
interface SuccessTicketProps {
  variant: 'recharge' | 'subscription';
  // 充值
  amountYuan?: number;
  tokens?: number;
  orderId?: string;
  // 订阅
  planName?: string;
  dailyLimit?: number;
  expiresAt?: string;
  // 按钮
  primaryText?: string;
  secondaryText?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}

function useCountUp(target: number, duration = 1100): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function SuccessTicket({
  variant,
  amountYuan,
  tokens,
  orderId,
  planName,
  dailyLimit,
  expiresAt,
  primaryText,
  secondaryText,
  onPrimary,
  onSecondary,
}: SuccessTicketProps) {
  const isRecharge = variant === 'recharge';
  const bigValue = isRecharge ? (tokens ?? Math.round((amountYuan || 0) * 100)) : (dailyLimit || 0);
  const shown = useCountUp(bigValue);

  const chip = isRecharge ? '✦ 充能成功' : '✦ 订阅成功';
  const eyebrow = isRecharge ? 'TOKUP ENERGY · 已到账' : 'TOKUP PRO · 权益已生效';
  const unit = isRecharge ? 'Tokens' : 'Tokens / 天';
  const unitNote = isRecharge ? '能量额度' : '每日免费额度';
  const headline = isRecharge
    ? `¥${Number(amountYuan || 0).toFixed(2)} 能量已实时到账`
    : `${planName || '订阅套餐'} 已生效 · 余额消费 9 折`;
  const sub = isRecharge
    ? '全部模型立即可用 · Token 长期有效不过期'
    : expiresAt
      ? `有效期至 ${expiresAt} · 每日北京时间 0 点重置`
      : '每日北京时间 0 点重置 · 额度不累积';
  const stamp = isRecharge ? '已到账' : '已开通';
  const noText = isRecharge ? (orderId ? `NO.${orderId}` : '') : `NO.${planName || 'PRO'}`;
  const ctaPrimary = primaryText || (isRecharge ? '开始使用' : '去工作台体验');
  const ctaSecondary = secondaryText || '完成';

  return (
    <div className="tk-overlay" role="dialog" aria-modal="true">
      {/* 背景辉光 + 飘浮光点 */}
      <div className="tk-halo" />
      <div className="tk-spark tk-spark-1" />
      <div className="tk-spark tk-spark-2" />
      <div className="tk-spark tk-spark-3" />
      <div className="tk-spark tk-spark-4" />

      <div className="tk-stage">
        {/* 券卡 */}
        <div className="tk-card">
          <div className="tk-sheen" />
          <div className="tk-sweep" />

          <div className="tk-chip">{chip}</div>
          <p className="tk-eyebrow">{eyebrow}</p>

          <div className="tk-num-wrap">
            <span className="tk-num">{fmt(shown)}</span>
            <span className="tk-unit">{unit}</span>
          </div>
          <p className="tk-num-note">{unitNote}</p>

          <div className="tk-headline">{headline}</div>
          <div className="tk-sub">{sub}</div>

          {/* 撕票线 + 两个圆孔 */}
          <div className="tk-perforation">
            <span className="tk-hole tk-hole-l" />
            <span className="tk-hole tk-hole-r" />
          </div>

          <div className="tk-footer">
            <span className="tk-no">{noText}</span>
            <span className="tk-stamp">{stamp}</span>
          </div>
        </div>

        {/* 按钮 */}
        <div className="tk-actions">
          <button className="tk-btn-primary" onClick={onPrimary}>{ctaPrimary} →</button>
          {onSecondary && (
            <button className="tk-btn-ghost" onClick={onSecondary}>{ctaSecondary}</button>
          )}
        </div>
      </div>
    </div>
  );
}
