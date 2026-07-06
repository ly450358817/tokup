import { useEffect } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      const origOverflow = root.style.overflow;
      root.style.overflow = 'visible';
      root.style.height = 'auto';
      return () => {
        root.style.overflow = origOverflow || '';
        root.style.height = '';
      };
    }
  }, []);
  const { isAuth, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuth) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuth, loading, navigate]);

  if (loading) return null;

  return (
    <div style={{ background: '#06060B', minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: '#fff', fontFamily: "'Inter',-apple-system,sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      {/* Background layers */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(5,150,105,0.04) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(13,148,136,0.02) 0%, transparent 50%)'
      }} />
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.005) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.005) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 30%, transparent 70%)'
      }} />

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px' }}>
        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{ width: 7, height: 7, background: '#10B981', transform: 'rotate(45deg)', boxShadow: '0 0 16px rgba(16,185,129,0.15)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.02em' }}>TokUp</span>
          <span style={{ fontSize: 10, fontWeight: 300, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>脉充</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <a onClick={() => navigate('/pricing')} style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 11, cursor: 'pointer', letterSpacing: '0.04em' }}>模型</a>
          <a onClick={() => navigate('/pricing')} style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 11, cursor: 'pointer', letterSpacing: '0.04em' }}>订阅</a>
          <a onClick={() => navigate('/docs')} style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 11, cursor: 'pointer', letterSpacing: '0.04em' }}>文档</a>
          <a onClick={() => navigate('/login')} style={{ padding: '8px 22px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 11, cursor: 'pointer' }}>开始使用</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 20000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '180px 24px 30px' }}>
        {/* Arch - simple visible SVG */}
        <div style={{ width: '100%', maxWidth: 700, height: 120, marginBottom: 8 }}>
          <svg width="100%" height="100%" viewBox="0 0 700 120" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="archGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.1"/>
                <stop offset="50%" stopColor="#10B981" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.1"/>
              </linearGradient>
              <linearGradient id="archGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0"/>
                <stop offset="50%" stopColor="#10B981" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
              </linearGradient>
              <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.6"/>
                <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
              </radialGradient>
              <animateMotion id="dotMove" dur="4s" repeatCount="indefinite">
                <mpath href="#archPath"/>
              </animateMotion>
            </defs>
            <path id="archPath" d="M 20,110 C 160,5 540,5 680,110" fill="none" stroke="url(#archGrad)" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
            <path d="M 20,110 C 160,5 540,5 680,110" fill="none" stroke="url(#archGlow)" strokeWidth="14" strokeLinecap="round" opacity="0.3" style={{filter:'blur(6px)', WebkitFilter:'blur(6px)'}}/>
            <circle r="3" fill="#10B981" opacity="0.95" style={{filter:'blur(1px)'}}>
              <animateMotion dur="3.5s" repeatCount="indefinite" rotate="auto">
                <mpath href="#archPath"/>
              </animateMotion>
            </circle>
            <circle r="8" fill="url(#dotGlow)" opacity="0.5">
              <animateMotion dur="3.5s" repeatCount="indefinite" rotate="auto">
                <mpath href="#archPath"/>
              </animateMotion>
            </circle>
          </svg>
        </div>

        {/* Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', marginBottom: 20 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(16,185,129,0.6)', boxShadow: '0 0 8px rgba(16,185,129,0.3)' }} />
          19 models · compliant · transparent
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 10 }}>
            <span style={{ background: 'linear-gradient(135deg,#fff 30%,rgba(255,255,255,0.7) 60%,#10B981 100%)', display: 'inline-block', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Up Your AI</span><br />
            <span style={{ display: 'block', marginTop: 8, color: 'rgba(255,255,255,0.35)', fontSize: 'clamp(12px,1.4vw,16px)', letterSpacing: '0.2em', fontWeight: 300 }}>Token Gateway</span>
          </h1>
          <div style={{ fontSize: 'clamp(9px,0.9vw,11px)', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', marginBottom: 24, lineHeight: 1.6 }}>
            统一接入 GPT、Claude、DeepSeek 等主流模型。一个余额，零锁定。
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <a onClick={() => navigate('/login')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 32px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', color: 'rgba(16,185,129,0.7)', fontSize: 12, fontWeight: 500, letterSpacing: '0.03em', textDecoration: 'none', cursor: 'pointer' }}>
              开始使用 <span style={{ fontSize: 14 }}>→</span>
            </a>
            <a onClick={() => navigate('/login')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', borderRadius: 10, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', fontSize: 12, fontWeight: 500, letterSpacing: '0.03em', textDecoration: 'none', cursor: 'pointer' }}>
              🎁 免费注册送 ¥10
            </a>
          </div>
        </div>

        {/* Model bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 20px', borderRadius: 999, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}><span style={{ color: 'rgba(16,185,129,0.6)', fontWeight: 500 }}>GPT</span>-5.5</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}><span style={{ color: 'rgba(16,185,129,0.6)', fontWeight: 500 }}>Claude</span> F5</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}><span style={{ color: 'rgba(16,185,129,0.6)', fontWeight: 500 }}>DS</span> V4 Pro</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}><span style={{ color: 'rgba(16,185,129,0.6)', fontWeight: 500 }}>Qwen</span> 3.7</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>+15 more</span>
        </div>
      </section>

      {/* Features */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1000, margin: '0 auto', padding: '30px 24px 40px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 24, fontWeight: 500, color: 'rgba(255,255,255,0.85)', marginBottom: 6 }}>Why TokUp</h2>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.08)', marginBottom: 32, fontWeight: 300 }}>Built for developers who demand transparency and reliability.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 14, overflow: 'hidden' }}>
          {[
            {icon: '⬡', title: '合规上游', desc: 'DeepSeek 等模型通过七牛云合规链路接入，通过「清朗 AI」行动要求。'},
            {icon: '▦', title: '逐笔审计', desc: '每次 API 调用的模型、Token、费用均记录在案，支持 CSV 导出。'},
            {icon: '◈', title: '数据不落地', desc: 'API 只做透传转发，消息内容不留存数据库，调用完即丢弃。'},
            {icon: '⇄', title: 'OpenAI 兼容', desc: '改一行代码即可接入。同一套 SDK，同一种格式，零迁移成本。'},
            {icon: '△', title: 'AI 安全护盾', desc: '12 层防护：SQL 注入、XSS、速率限制、IP 封禁、异常检测、人机验证、会话管理、Key 异常检测全覆盖。'},
            {icon: '☆', title: '免费体验', desc: '注册送 ¥10 体验金，无需绑卡。邀请好友双方各得 ¥5。'},
          ].map((f, i) => (
            <div key={i} style={{ padding: '24px 22px', background: '#06060B' }}>
              <span style={{ fontSize: 18, marginBottom: 10, display: 'block', color: 'rgba(16,185,129,0.5)' }}>{f.icon}</span>
              <h3 style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7, fontWeight: 300 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 24px 40px' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', padding: '36px 32px', borderRadius: 16, background: 'linear-gradient(135deg,rgba(16,185,129,0.03),transparent)', border: '1px solid rgba(16,185,129,0.06)' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10, lineHeight: 1.6 }}>
            注册即送 <span style={{ color: '#10B981', fontWeight: 500 }}>¥10 体验金</span>，无需绑卡。<br />OpenAI 兼容 SDK，改一行代码即可接入。
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.08)', fontWeight: 300, letterSpacing: '0.03em' }}>稳定、透明、合规，开发者信赖的 AI API 入口。</p>
        </div>
      </section>
    </div>
  );
}
