import { useState, useEffect, useRef } from 'react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';

export default function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [searchParams] = [new URLSearchParams(window.location.search)];
  const inviteCode = searchParams.get('code') || '';
  const { login, register } = useAuth();
  const { t } = useLang();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        const turnstileWidget = document.querySelector('.cf-turnstile');
        let token = '';
        if (turnstileWidget && (window as any).turnstile) {
          token = (window as any).turnstile.getResponse(turnstileWidget);
        }
        await register(email, password, token, inviteCode);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let dots: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 12000));
    for (let i = 0; i < count; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            ctx.globalAlpha = (1 - dist / 180) * 0.3;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw dots
      ctx.globalAlpha = 1;
      for (const dot of dots) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${dot.alpha})`;
        ctx.fill();
        
        dot.x += dot.vx;
        dot.y += dot.vy;
        if (dot.x < 0 || dot.x > canvas.width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > canvas.height) dot.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    // Load Turnstile if not already loaded
    if (!(window as any).turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0A0A0F] flex items-center justify-center p-4" style={{ zIndex: 10 }}>
      {/* Animated particle background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0, position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
      />

      {/* Auth card */}
      <div className="relative w-full max-w-2xl">
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
              <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder={t.auth.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
              </div>
            </div>

            {error && (
              <p className="text-[12px] text-red-400 text-center">{error}</p>
            )}

            {mode === 'register' && !error && (
              <p className="text-[10px] text-white/20 text-center leading-relaxed">
                At least 6 characters
              </p>
            )}

            <div className="cf-turnstile mb-3 flex justify-center" data-sitekey="0x4AAAAAADvk_9V0AN5HmbHc" data-theme="dark" data-size="normal" />
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
