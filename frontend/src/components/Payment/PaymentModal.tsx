import { useState, useEffect, useRef } from 'react';
import { paymentApi } from '../../utils/api';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { useLang } from '../../contexts/LanguageContext';

/* ── Alipay brand icon ── */
function AlipayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#1677FF"/>
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif">支</text>
    </svg>
  );
}

const PACKAGES = [
  { id: 'monthly', label: '月卡', tokens: 9900, price: 99.0, originalPrice: 129.0, desc: '新用户特惠', popular: false },
  { id: 'quarterly', label: '季卡', tokens: 30000, price: 199.0, desc: '日均¥2.2 · 最受欢迎', popular: true },
  { id: 'yearly', label: '年卡', tokens: 120000, price: 499.0, desc: '日均¥1.4 · 超值长享', popular: false },
];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ onClose, onSuccess }: Props) {
  const { t } = useLang();
  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };
  const [selected, setSelected] = useState('quarterly');
  const [method, setMethod] = useState<'alipay' | 'wechat'>('wechat');
  const [paying, setPaying] = useState(false);
  const [payUrl, setPayUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pkg = PACKAGES.find(p => p.id === selected)!;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const pollStatus = (oid: string, count = 0) => {
    if (count > 120) return; // 6 minute max
    pollRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('tokup_token');
        const res = await fetch('/api/payment/order/' + oid, {
          headers: { 'Authorization': 'Bearer ' + (token || '') }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed') {
            setPaid(true);
            setTimeout(() => onSuccess(), 1800);
            return;
          }
        }
      } catch (_) { /* retry */ }
      pollStatus(oid, count + 1);
    }, 3000);
  };

  const handlePay = async () => {
    setPaying(true);
    setError('');
    setPayUrl('');
    setOrderId('');
    setPaid(false);
    try {
      const res = await paymentApi.recharge(selected, method);
      if (res.success) {
        setOrderId(res.order_id || '');
        setPayUrl(res.pay_url || '');

        // XorPay / real payment: show QR + poll
        if (res.order_id) {
          pollStatus(res.order_id);
        } else {
          // Mock fallback: auto-complete after delay
          setTimeout(() => onSuccess(), 3000);
        }
      } else {
        setError(res.message || 'Payment failed');
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Network error');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg mx-4 bg-[#0E0E16] border border-white/[0.06] rounded-2xl shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04]">
          <h2 className="text-lg font-semibold text-white">{tr("payment.title")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Paid overlay */}
          {paid ? (
            <div className="flex flex-col items-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <p className="text-white font-medium text-lg">{tr("payment.success")}</p>
              <p className="text-white/40 text-sm">¥{pkg.price} · {pkg.tokens.toLocaleString()} tokens</p>
            </div>
          ) : (
            <>
              {/* Package selection */}
              <div>
                <p className="text-[11px] text-white/30 tracking-[0.1em] uppercase mb-3">{tr("payment.selectPackage")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {PACKAGES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={`relative rounded-xl p-4 text-left transition-all border ${
                        selected === p.id
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      {p.popular && (
                        <span className="absolute -top-2 right-3 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-medium rounded-full">
                          POPULAR
                        </span>
                      )}
                      <p className="text-[13px] font-medium text-white">{p.label}</p>
                      <p className="text-[22px] font-bold text-white mt-1">¥{p.price}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">{p.tokens.toLocaleString()} {tr("payment.tokensLabel")}</p>
                      <p className="text-[10px] text-white/20 mt-1">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment method */}
              <div>
                <p className="text-[11px] text-white/30 tracking-[0.1em] uppercase mb-3">{tr("payment.paymentMethod")}</p>
              <div className="flex gap-3">
                {/* WeChat Pay first — as requested */}
                <button
                  onClick={() => setMethod('wechat')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-all border ${
                    method === 'wechat'
                      ? 'border-emerald-500/40 bg-emerald-500/5 text-white'
                      : 'border-white/[0.06] text-white/40 hover:text-white/70'
                  }`}
                >
                  <span className="w-[28px] h-[28px] rounded-lg bg-white flex items-center justify-center shrink-0">
                    <img src="/assets/wechatpay.jpeg" className="w-[24px] h-[24px] object-contain" alt="WeChat Pay" style={{mixBlendMode:"multiply"}} />
                  </span>
                  WeChat Pay
                </button>
                <button
                  onClick={() => setMethod('alipay')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-all border ${
                      method === 'alipay'
                        ? 'border-blue-500/40 bg-blue-500/5 text-white'
                        : 'border-white/[0.06] text-white/40 hover:text-white/70'
                    }`}
                  >
                  <AlipayIcon size={18} />
                  Alipay
                </button>
              </div>
              </div>

              {/* QR Code display */}
              {payUrl ? (
                <div className="flex flex-col items-center py-4">
                  <div className="w-48 h-48 rounded-xl bg-white p-3 flex items-center justify-center">
                    <img src={payUrl} alt="QR Code" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[12px] text-white/40 mt-3">
                    {tr("payment.scanWith")} {method === 'alipay' ? 'Alipay' : 'WeChat'}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    <p className="text-[11px] text-white/30">{tr("payment.waiting")}</p>
                  </div>
                </div>
              ) : (
                /* Pay button */
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-sm hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {paying ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    `Pay ¥${pkg.price}`
                  )}
                </button>
              )}

              {error && (
                <p className="text-[12px] text-red-400 text-center">{error}</p>
              )}

              {/* Price per token */}
              <div className="flex justify-center gap-4 text-[10px] text-white/20">
                <span>{tr("payment.rate")}: ¥0.01 / {tr("payment.tokensLabel")}</span>
                <span>|</span>
                <span>{tr("payment.rateLocked")}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
