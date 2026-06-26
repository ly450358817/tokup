import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const { t } = useLang();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
      {/* Background energy ring */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <svg width="600" height="600" viewBox="0 0 600 600" className="opacity-[0.08]">
          <circle cx="300" cy="300" r="240" fill="none" stroke="url(#bg_grad)" strokeWidth="1"
            strokeDasharray="1500" strokeDashoffset="600" />
          <circle cx="300" cy="300" r="200" fill="none" stroke="url(#bg_grad)" strokeWidth="0.5"
            strokeDasharray="1200" strokeDashoffset="400" />
          <circle cx="300" cy="300" r="160" fill="none" stroke="url(#bg_grad)" strokeWidth="0.3"
            strokeDasharray="1000" strokeDashoffset="300" />
          <defs>
            <radialGradient id="bg_grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Auth card */}
      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-4">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="url(#logo_g)" strokeWidth="2" strokeLinecap="round"
                strokeDasharray="100" strokeDashoffset="25" />
              <circle cx="24" cy="24" r="22" stroke="rgba(16,185,129,0.08)" strokeWidth="2" />
              <text x="24" y="30" textAnchor="middle" fill="#10B981" fontSize="18" fontWeight="700" fontFamily="Inter">T</text>
              <defs>
                <linearGradient id="logo_g" x1="0" y1="0" x2="48" y2="48">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#34D399" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-2xl" />
          </div>
          <h1 className="text-[22px] font-semibold text-white tracking-tight">TokUp</h1>
          <p className="text-[12px] text-white/30 mt-1 tracking-[0.1em]">脉充</p>
        </div>

        {/* Form */}
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
          {/* Tabs */}
          <div className="flex mb-8 bg-white/[0.03] rounded-xl p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                mode === 'login' ? 'bg-white/[0.08] text-white font-medium' : 'text-white/30 hover:text-white/60'
              }`}
            >
              {t.auth.signIn}
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                mode === 'register' ? 'bg-white/[0.08] text-white font-medium' : 'text-white/30 hover:text-white/60'
              }`}
            >
              {t.auth.register}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder={t.auth.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input"
                required
              />
            </div>
            <div>
              <input
                type="password"
                placeholder={t.auth.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input"
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-[12px] text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-sm hover:bg-emerald-500/20 transition-all disabled:opacity-50"
            >
              {loading ? '...' : mode === 'login' ? t.auth.signIn : t.auth.createAccount}
            </button>
          </form>

          <p className="text-[10px] text-white/20 text-center mt-6">
            {t.auth.terms}
          </p>
        </div>
      </div>
    </div>
  );
}
