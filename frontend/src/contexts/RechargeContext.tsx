import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import PaymentModal from '../components/Payment/PaymentModal';
import { CheckCircle, XCircle } from 'lucide-react';

interface RechargeContextType {
  openRecharge: () => void;
}

const RechargeContext = createContext<RechargeContextType>({} as RechargeContextType);

function Toast({ message, type, visible }: { message: string; type: 'success' | 'error'; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
      <div className="backdrop-blur-xl bg-[#16161E]/95 border border-white/[0.06] rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-3 min-w-[280px]">
        {type === 'success' ? (
          <CheckCircle size={18} className="text-emerald-400 shrink-0" />
        ) : (
          <XCircle size={18} className="text-red-400 shrink-0" />
        )}
        <span className="text-[13px] text-white">{message}</span>
      </div>
    </div>
  );
}

export function RechargeProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <RechargeContext.Provider value={{ openRecharge: () => setShow(true) }}>
      {children}
      {show && (
        <PaymentModal
          onClose={() => setShow(false)}
          onSuccess={() => {
            setShow(false);
            showToast('Recharge successful', 'success');
            setTimeout(() => window.location.reload(), 1500);
          }}
          onError={(msg) => {
            setShow(false);
            showToast(msg || 'Payment failed', 'error');
          }}
        />
      )}
      <Toast message={toast?.message || ''} type={toast?.type || 'success'} visible={!!toast} />
    </RechargeContext.Provider>
  );
}

export const useRecharge = () => useContext(RechargeContext);
