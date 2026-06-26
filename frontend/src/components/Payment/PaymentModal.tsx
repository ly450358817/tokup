 import { useState } from 'react';
 import { paymentApi } from '../../utils/api';
import { X } from 'lucide-react';

/* ── Alipay brand icon ── */
function AlipayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#1677FF"/>
      <text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif">支</text>
    </svg>
  );
}

/* ── WeChat Pay brand icon ── */
function WechatIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#07C160"/>
      <path d="M16 8C11.58 8 8 11.06 8 14.8c0 2.04 1.02 3.88 2.62 5.14l-.66 2.46a.4.4 0 0 0 .58.44l2.72-1.6c.88.24 1.8.36 2.74.36 4.42 0 8-3.06 8-6.8C26 11.06 22.42 8 16 8zm-3.2 5.6a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4zm6.4 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z" fill="white"/>
      <path d="M20.4 16c-.26 0-.52.02-.78.06.18.56.28 1.16.28 1.74 0 1.7-.74 3.24-1.94 4.38l.46 1.72a.28.28 0 0 1-.4.31l-1.9-1.12c-.62.16-1.26.24-1.92.24-1.06 0-2.08-.18-3-.52l-.84.5c.82.68 1.8 1.2 2.88 1.52l.5 1.88a.4.4 0 0 0 .58.44l2.72-1.6c.88.24 1.8.36 2.74.36 4.42 0 8-3.06 8-6.8 0-1.44-.56-2.76-1.5-3.86-.5.68-1.14 1.26-1.9 1.7a4.76 4.76 0 0 1-2.1.57z" fill="white" opacity="0.8"/>
    </svg>
  );
}


 
 const PACKAGES = [
   { id: 'trial', label: '体验包', tokens: 990, price: 9.9, desc: '适合轻度体验' },
   { id: 'light', label: '轻量包', tokens: 2990, price: 29.9, desc: '日常轻度使用', popular: false },
   { id: 'standard', label: '标准包', tokens: 9900, price: 99.0, desc: '中度使用推荐', popular: true },
   { id: 'pro', label: '专业包', tokens: 29900, price: 299.0, desc: '重度用户首选' },
 ];
 
 interface Props {
   onClose: () => void;
   onSuccess: () => void;
 }
 
 export default function PaymentModal({ onClose, onSuccess }: Props) {
   const [selected, setSelected] = useState('standard');
   const [method, setMethod] = useState<'alipay' | 'wechat'>('alipay');
   const [paying, setPaying] = useState(false);
   const [payUrl, setPayUrl] = useState('');
   const [error, setError] = useState('');
 
   const pkg = PACKAGES.find(p => p.id === selected)!;
 
   const handlePay = async () => {
     setPaying(true);
     setError('');
     try {
       const res = await paymentApi.recharge(selected, method);
       if (res.success) {
         if (res.pay_url && res.pay_url.startsWith('http') && !res.pay_url.includes('qrserver')) {
           // Real payment URL - redirect user
           window.open(res.pay_url, '_blank');
           setPayUrl(res.pay_url);
         } else {
           // Mock QR code
           setPayUrl(res.pay_url);
           setTimeout(() => {
             paymentApi
               .recharge(selected, method)
               .then(() => onSuccess())
               .catch(() => {});
           }, 3000);
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
           <h2 className="text-lg font-semibold text-white">Recharge</h2>
           <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-all">
             <X size={18} />
           </button>
         </div>
 
         <div className="p-6 space-y-6">
           {/* Package selection */}
           <div>
             <p className="text-[11px] text-white/30 tracking-[0.1em] uppercase mb-3">Select Package</p>
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
 
           {/* Payment method */}
           <div>
             <p className="text-[11px] text-white/30 tracking-[0.1em] uppercase mb-3">Payment Method</p>
             <div className="flex gap-3">
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
               <button
                 onClick={() => setMethod('wechat')}
                 className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-all border ${
                   method === 'wechat'
                     ? 'border-emerald-500/40 bg-emerald-500/5 text-white'
                     : 'border-white/[0.06] text-white/40 hover:text-white/70'
                 }`}
               >
                 <span className="w-[28px] h-[28px] rounded-lg bg-white flex items-center justify-center shrink-0"><img src="/assets/wechatpay.jpeg" className="w-[24px] h-[24px] object-contain" alt="WeChat Pay" style={{mixBlendMode:"multiply"}} /></span>
                 WeChat Pay
               </button>
             </div>
           </div>
 
           {/* Pay button */}
           {!payUrl && (
             <button
               onClick={handlePay}
               disabled={paying}
               className="w-full py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-sm hover:bg-emerald-500/20 transition-all disabled:opacity-50"
             >
               {paying ? 'Processing...' : `Pay ¥${pkg.price}`}
             </button>
           )}
 
           {/* QR code (simulated) */}
           {payUrl && (
             <div className="flex flex-col items-center py-4">
               <div className="w-48 h-48 rounded-xl bg-white p-3 flex items-center justify-center">
                 <div className="text-center">
                   <img src={payUrl} alt="QR Code" className="w-full h-full object-contain" />
                 </div>
               </div>
               <p className="text-[12px] text-white/40 mt-3">
                 Scan with {method === 'alipay' ? 'Alipay' : 'WeChat'}
               </p>
               <p className="text-[10px] text-white/20 mt-1">Auto-redirecting after payment...</p>
             </div>
           )}
 
           {error && (
             <p className="text-[12px] text-red-400 text-center">{error}</p>
           )}
 
           {/* Price per token */}
           <div className="flex justify-center gap-4 text-[10px] text-white/20">
             <span>Rate: ¥0.01 / token</span>
             <span>|</span>
             <span>Exchange rate locked</span>
           </div>
         </div>
       </div>
     </div>
   );
 }
 
