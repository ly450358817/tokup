import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, BarChart3, Globe, Zap, Sparkles, Coins } from 'lucide-react';

function ThreeSceneFallback() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.02) 0%, transparent 70%)'
    }}>
      <style>{'@keyframes three-placeholder { 0%,100% { transform: scale(1); opacity: 0.2; } 50% { transform: scale(1.1); opacity: 0.5; } }'}</style>
      <div style={{
        width: 100, height: 100, borderRadius: '50%',
        border: '1px solid rgba(16,185,129,0.1)',
        animation: 'three-placeholder 3s ease-in-out infinite',
      }} />
    </div>
  );
}

const ThreeScene = lazy(() => import('./ThreeScene'));

function GlassCard({
  children,
  gradient,
  delay,
}: {
  children: React.ReactNode;
  gradient: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [hovered, setHovered] = useState(false);

  const handleMouse = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setPos({ x: px, y: py });
    if (glowRef.current) glowRef.current.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, ${gradient}28 0%, transparent 70%)`;
  };

  const rx = (pos.y - 0.5) * 14;
  const ry = (pos.x - 0.5) * -14;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        ref={ref}
        onMouseMove={handleMouse}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPos({ x: 0.5, y: 0.5 }); if (glowRef.current) glowRef.current.style.background = `radial-gradient(circle at 50% 50%, ${gradient}08 0%, transparent 70%)`; }}
        style={{
          padding: '28px 24px',
          borderRadius: 18,
          cursor: 'default',
          position: 'relative',
          overflow: 'hidden',
          transform: `perspective(900px) rotateX(${hovered ? rx : 0}deg) rotateY(${hovered ? ry : 0}deg) scale(${hovered ? 1.02 : 1}) translateY(${hovered ? -6 : 0}px)`,
          transition: 'transform 0.15s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease',
          boxShadow: hovered ? `0 12px 40px ${gradient}15, 0 0 0 1px ${gradient}22 inset` : `0 0 0 1px rgba(255,255,255,0.06) inset`,
          background: hovered ? 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))' : 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div ref={glowRef} style={{ position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none', background: `radial-gradient(circle at 50% 50%, ${gradient}08 0%, transparent 70%)`, transition: 'background 0.15s ease' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none', opacity: hovered ? 0.8 : 0.3, background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.04) 35%, transparent 40%)', transition: 'opacity 0.4s ease' }} />
        <div style={{ position: 'absolute', inset: -1, borderRadius: 19, pointerEvents: 'none', opacity: hovered ? 1 : 0, background: `linear-gradient(135deg, ${gradient}30, transparent 50%, ${gradient}10)`, transition: 'opacity 0.3s ease', zIndex: -1 }} />
        <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
      </div>
    </motion.div>
  );
}

const FEATURES = [
  { icon: Shield, title: '合规上游', desc: '主流 AI 模型均通过合规上游链路接入。', gradient: '#10B981' },
  { icon: BarChart3, title: '逐笔审计', desc: '每次 API 调用的模型、Token、费用均记录在案。', gradient: '#14B8A6' },
  { icon: Globe, title: '数据有边界', desc: '对话内容按《隐私政策》留存，仅用于安全与计费，不用于训练、不对外提供。', gradient: '#3B82F6' },
  { icon: Zap, title: 'OpenAI 兼容', desc: '改一行代码即可接入。零迁移成本。', gradient: '#8B5CF6' },
  { icon: Sparkles, title: 'AI 安全护盾', desc: '12 层防护，全方位保护您的 API。', gradient: '#F59E0B' },
  { icon: Coins, title: '按量付费', desc: '注册即用，用多少扣多少，透明计价。', gradient: '#EC4899' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuth, loading } = useAuth();

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    const prev = root.style.overflow;
    root.style.overflow = 'visible';
    root.style.height = 'auto';
    return () => { root.style.overflow = prev || ''; root.style.height = ''; };
  }, []);

  useEffect(() => {
    if (!loading && isAuth) navigate('/dashboard', { replace: true });
  }, [isAuth, loading, navigate]);

  if (loading) return null;

  return (
    <div style={{ background: '#13131D', minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: '#fff', fontFamily: "-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <Suspense fallback={<ThreeSceneFallback />}><ThreeScene /></Suspense>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(6,6,11,0.4) 100%)' }} />

      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px' }}>
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{ width: 7, height: 7, background: '#10B981', transform: 'rotate(45deg)', boxShadow: '0 0 16px rgba(16,185,129,0.15)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.02em' }}>TokUp</span>
          <span style={{ fontSize: 10, fontWeight: 300, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>脉充</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <span onClick={() => navigate('/pricing')} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.04em' }}>模型</span>
          <span onClick={() => navigate('/pricing')} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.04em' }}>订阅</span>
          <span onClick={() => navigate('/docs')} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.04em' }}>文档</span>
          <span onClick={() => navigate('/login')} style={{ fontSize: 11, padding: '8px 18px', borderRadius: 9999, cursor: 'pointer', color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>登录</span>
          <span onClick={() => navigate('/register?mode=register')} style={{ fontSize: 11, padding: '8px 18px', borderRadius: 9999, cursor: 'pointer', color: '#13131D', background: '#10B981', fontWeight: 500 }}>注册</span>
        </div>
      </nav>

      <section style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '100vh', padding: '0 24px 0 36px', transform: 'translateY(-12px)' }}>
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 9999, marginBottom: 32, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)', backdropFilter: 'blur(12px)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px rgba(16,185,129,0.4)' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>API 服务已稳定运行</span>
          </motion.div>

          <h1 style={{ fontSize: 60, fontWeight: 300, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)', margin: '0 0 16px', textShadow: '0 2px 40px rgba(0,0,0,0.3)', lineHeight: 1.2 }}>
            大模型，不该是大开支
          </h1>

          <p style={{ fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.4)', maxWidth: 480, margin: '0 auto', lineHeight: 1.8, letterSpacing: '0.02em', textShadow: '0 1px 20px rgba(0,0,0,0.4)' }}>
            Built for developers who demand transparency and reliability.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 48, padding: '12px 24px', borderRadius: 9999, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <span style={{ fontSize: 10, color: 'rgb(16,185,129)', fontWeight: 500, letterSpacing: '0.02em' }}>GPT-5.6</span><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 3 }}> / Codex</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: 'rgb(16,185,129)', fontWeight: 500 }}>DeepSeek</span><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 3 }}>V4</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: 'rgb(16,185,129)', fontWeight: 500 }}>Claude</span><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 3 }}>Fable 5</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: 'rgb(16,185,129)', fontWeight: 500 }}>Qwen</span><span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 3 }}>3.7 Max</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: 'rgb(16,185,129)', fontWeight: 500 }}>+10+</span>
        </motion.div>
      </section>

      <section style={{ position: 'relative', zIndex: 50, maxWidth: 1000, margin: '0 auto', padding: '0 24px 80px' }}>
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ textAlign: 'center', fontSize: 26, fontWeight: 500, color: 'rgba(255,255,255,0.88)', marginBottom: 6 }}>Why TokUp</motion.h2>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.5 }} style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 40, fontWeight: 300 }}>Built for developers who demand transparency and reliability.</motion.p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {FEATURES.map((f, i) => (
            <GlassCard key={i} gradient={f.gradient} delay={i * 0.07}>
              <motion.div initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.07 + 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
                <f.icon size={22} style={{ color: f.gradient, marginBottom: 14, display: 'block' }} />
                <h3 style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.72)', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7, fontWeight: 300, margin: 0 }}>{f.desc}</p>
              </motion.div>
            </GlassCard>
          ))}
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 24px 60px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ maxWidth: 520, margin: '0 auto', padding: '40px 36px', borderRadius: 16, background: 'linear-gradient(135deg, rgba(16,185,129,0.03), transparent)', border: '1px solid rgba(16,185,129,0.06)', backdropFilter: 'blur(12px)' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12, lineHeight: 1.7 }}>
            OpenAI 兼容 SDK，改一行代码即可接入。<br />稳定、透明、合规，开发者信赖的 AI API 入口。
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 300, letterSpacing: '0.03em' }}>稳定、透明、合规，开发者信赖的 AI API 入口。</p>
        </motion.div>
      </section>
    </div>
  );
}
