import { useState, useEffect, useRef } from 'react';
import { paymentApi } from '../../utils/api';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { useLang } from '../../contexts/LanguageContext';

const PACKAGES = [
  { id: 'trial', label: '体验包', tokens: 2990, price: 29.9, desc: '低门槛尝鲜', popular: false },
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
  const [paying, setPaying] = useState(false);
  const [payUrl, setPayUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pkg = PACKAGES.find(p => p.id === selected)!;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const pollStatus = (oid: string, count = 0) => {
    if (count > 120) return;
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
      } catch (_) { }
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
      const res = await paymentApi.recharge(selected, 'wechat');
      if (res.success) {
        setOrderId(res.order_id || '');
        setPayUrl(res.pay_url || '');
        if (res.order_id) {
          pollStatus(res.order_id);
        } else {
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
        className="relative w-full max-w-lg mx-4 bg-[#1C1C26] border border-white/[0.06] rounded-2xl shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04]">
          <h2 className="text-lg font-semibold text-white">充值</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {paid ? (
            <div className="flex flex-col items-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <p className="text-white font-medium text-lg">支付成功</p>
              <p className="text-white/40 text-sm">¥{pkg.price} · {pkg.tokens.toLocaleString()} tokens</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[11px] text-white/30 tracking-[0.1em] uppercase mb-3">选择套餐</p>
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
                      <p className="text-[11px] text-white/30 mt-0.5">{p.tokens.toLocaleString()} tokens</p>
                      <p className="text-[10px] text-white/20 mt-1">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] text-white/30 tracking-[0.1em] uppercase mb-3">支付方式</p>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm border border-emerald-500/40 bg-emerald-500/5 text-white">
                    <span className="w-[28px] h-[28px] rounded-lg bg-white flex items-center justify-center shrink-0">
                      <img src="/assets/wechatpay.jpeg" className="w-[24px] h-[24px] object-contain" alt="WeChat Pay" style={{mixBlendMode:"multiply"}} />
                    </span>
                    微信支付
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm border border-white/[0.06] text-white/30 cursor-not-allowed">
                    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                      <rect width="32" height="32" rx="6" fill="#1677FF" opacity="0.4"/>
                      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif" opacity="0.6">支</text>
                    </svg>
                    支付宝
                    <span className="text-[9px] text-white/20">即将开放</span>
                  </div>
                </div>
              </div>

              {payUrl ? (
                <div className="flex flex-col items-center py-4">
                  <div className="w-48 h-48 rounded-xl bg-white p-3 flex items-center justify-center">
                    <img src={payUrl} alt="QR Code" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[12px] text-white/40 mt-3">请使用微信扫码支付</p>
                  <p className="text-[10px] text-white/20 mt-1">支付名称: TokUp脉充</p>
                  <p className="text-[11px] text-amber-300/80 mt-2 text-center">二维码有效期 5 分钟，请尽快完成付款</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    <p className="text-[11px] text-white/30">等待支付...</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-sm hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {paying ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      处理中...
                    </span>
                  ) : (
                    `支付 ¥${pkg.price}`
                  )}
                </button>
              )}

              {error && (
                <p className="text-[12px] text-red-400 text-center">{error}</p>
              )}

              <div className="flex justify-center gap-4 text-[10px] text-white/20">
                <span>费率: ¥0.01 / Token</span>
                <span>|</span>
                <span>已锁定</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
