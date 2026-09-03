import { useState, useEffect, useRef } from 'react';
import { paymentApi } from '../../utils/api';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import SuccessTicket from './SuccessTicket';
import { useLang } from '../../contexts/LanguageContext';

const QUICK_AMOUNTS = [29.9, 50, 100, 200];

const QR_TTL = 300; // 秒，与后端 XorPay expire=300 一致（二维码有效期 5 分钟）

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  onError?: (msg?: string) => void;
}

export default function PaymentModal({ onClose, onSuccess, onError }: Props) {
  const { t } = useLang();
  const tr = (key: string): string => {
    const ks = key.split('.');
    let r: any = t;
    for (const k of ks) r = r?.[k];
    return r || key;
  };
  const [amount, setAmount] = useState('29.9');  // 默认 ¥29.9（新手首充引导）
  const [method, setMethod] = useState<'wechat' | 'alipay'>('wechat'); // 支付方式：wechat 微信 / alipay 支付宝
  const [paying, setPaying] = useState(false);
  const [payUrl, setPayUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [paid, setPaid] = useState(false);
  const [qrExpired, setQrExpired] = useState(false);
  const [expireLeft, setExpireLeft] = useState(QR_TTL);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const amountNum = Number(amount) || 0;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (expireRef.current) clearInterval(expireRef.current);
    };
  }, []);

  // 二维码过期：停止轮询，显示「重新生成」
  useEffect(() => {
    if (qrExpired && pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, [qrExpired]);

  // 5 分钟倒计时：payUrl 存在且未过期时每秒递减
  useEffect(() => {
    if (!payUrl || qrExpired) return;
    setExpireLeft(QR_TTL);
    expireRef.current = setInterval(() => {
      setExpireLeft((prev) => {
        if (prev <= 1) {
          if (expireRef.current) clearInterval(expireRef.current);
          expireRef.current = null;
          setQrExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (expireRef.current) clearInterval(expireRef.current);
      expireRef.current = null;
    };
  }, [payUrl, qrExpired]);

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
    setQrExpired(false);
    if (pollRef.current) clearTimeout(pollRef.current);
    if (expireRef.current) clearInterval(expireRef.current);
    const amt = Number(amount) || 0;
    if (amt < 1 || amt > 5000) {
      setError('请输入 ¥1 ~ ¥5000 之间的金额');
      setPaying(false);
      return;
    }
    try {
      const res = await paymentApi.rechargeAmount(amt, method);
      if (res.success) {
        setOrderId(res.order_id || '');
        setPayUrl(res.pay_url || '');
        if (res.order_id) {
          pollStatus(res.order_id);
        } else {
          setTimeout(() => onSuccess(), 3000);
        }
      } else {
        const msg = res.message || 'Payment failed';
        setError(msg);
        onError?.(msg);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Network error';
      setError(msg);
      onError?.(msg);
    } finally {
      setPaying(false);
    }
  };

  // 支付成功 → 展示「能量票券」动效（深蓝券面 + 大数字滚动 + 扫光）
  if (paid) {
    return (
      <SuccessTicket
        variant="recharge"
        amountYuan={amountNum}
        tokens={Math.round(amountNum * 100)}
        orderId={orderId}
        primaryText="开始使用"
        onPrimary={onSuccess}
      />
    );
  }

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
              <p className="text-white/40 text-sm">¥{amountNum.toFixed(2)} · {Math.round(amountNum * 100).toLocaleString()} tokens</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[11px] text-white/30 tracking-[0.1em] uppercase mb-3">充值金额</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">¥</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    step="0.1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="输入金额"
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm outline-none focus:border-emerald-500/40 transition-all"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  {QUICK_AMOUNTS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(String(v))}
                      className={`flex-1 py-2 rounded-lg text-xs transition-all border ${
                        Math.abs(amountNum - v) < 0.01
                          ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400'
                          : 'border-white/[0.06] text-white/40 hover:bg-white/[0.04]'
                      }`}
                    >
                      ¥{v}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/25 mt-2">1 元 = 100 Token · 本次到账 {Math.round(amountNum * 100).toLocaleString()} token</p>
              </div>

              <div>
                <p className="text-[11px] text-white/30 tracking-[0.1em] uppercase mb-3">支付方式</p>
                <div className="flex gap-3">
                  <div
                    onClick={() => setMethod('wechat')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm cursor-pointer select-none transition-all ${
                      method === 'wechat'
                        ? 'border border-emerald-500/40 bg-emerald-500/5 text-white'
                        : 'border border-white/[0.06] text-white/40 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="w-[28px] h-[28px] rounded-lg bg-white flex items-center justify-center shrink-0">
                      <img src="/assets/wechatpay.jpeg" className="w-[24px] h-[24px] object-contain" alt="WeChat Pay" style={{mixBlendMode:"multiply"}} />
                    </span>
                    微信支付
                  </div>
                  <div
                    onClick={() => setMethod('alipay')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm cursor-pointer select-none transition-all ${
                      method === 'alipay'
                        ? 'border border-[#1677FF]/60 bg-[#1677FF]/10 text-white'
                        : 'border border-white/[0.06] text-white/40 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="w-[28px] h-[28px] rounded-lg bg-[#1677FF] flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                        <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif">支</text>
                      </svg>
                    </span>
                    支付宝
                  </div>
                </div>
              </div>

              {payUrl ? (
                <div className="flex flex-col items-center py-4">
                  {qrExpired ? (
                    <>
                      <div className="w-48 h-48 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                        <p className="text-[13px] text-white/40 text-center px-4">二维码已过期</p>
                      </div>
                      <p className="text-[12px] text-white/40 mt-3">二维码已失效，请重新生成</p>
                      <button
                        onClick={handlePay}
                        disabled={paying}
                        className="mt-3 px-6 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {paying ? '生成中...' : '重新生成二维码'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-48 h-48 rounded-xl bg-white p-3 flex items-center justify-center">
                        <img src={payUrl} alt="QR Code" className="w-full h-full object-contain" />
                      </div>
                      <p className="text-[12px] text-white/40 mt-3">{method === 'wechat' ? '请使用微信扫码支付' : '请使用支付宝扫码支付'}</p>
                      <p className="lg:hidden text-[11px] text-white/30 mt-1 text-center">📱 手机端：请长按二维码识别，或截图后用微信「扫一扫」/「相册」识别</p>
                      <p className="text-[10px] text-white/20 mt-1">支付名称: TokUp脉充</p>
                      <p className="text-[11px] text-amber-300/80 mt-2 text-center">二维码有效期 5 分钟，剩余 {Math.floor(expireLeft / 60)} 分 {expireLeft % 60} 秒</p>
                      {method === 'alipay' && (
                        <p className="text-[11px] text-amber-300/70 mt-1 text-center">支付宝个人商户单笔限额 ¥1000，大额请分笔充值或使用微信</p>
                      )}
                      <p className="text-[11px] text-emerald-400/70 mt-1 text-center">支付成功后自动到账（一般几秒），无需人工处理</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                        <p className="text-[11px] text-white/30">等待支付...</p>
                      </div>
                    </>
                  )}
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
                    `支付 ¥${amountNum.toFixed(2)}`
                  )}
                </button>
              )}

              {error && (
                <p className="text-[12px] text-red-400 text-center">{error}</p>
              )}

              <div className="rounded-xl bg-amber-500/[0.07] border border-amber-500/25 px-3 py-2.5 text-[11px] text-amber-200/90 leading-relaxed text-center">
                <span className="font-medium text-amber-300">充值即同意：</span>数字商品不适用七天无理由退货；未使用余额原则上不退，平台原因、错误扣款、未成年人等法定情形除外，可联系客服处理。Token 长期有效不过期。
              </div>

              <div className="flex justify-center gap-3 text-[10px] text-white/25">
                <span>1 元 = 100 Token</span>
                <span>|</span>
                <span>最低 ¥1</span>
                <span>|</span>
                <span>单次最高 ¥5000</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
