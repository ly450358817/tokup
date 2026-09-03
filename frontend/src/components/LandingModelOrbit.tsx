import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/** 8 大主流模型家族（真实上游商标，本地化展示；用于营销首屏，不暗示官方合作） */
const FAMILIES = [
  { img: '/assets/brand/openai.svg',   name: 'GPT',     color: '#10A37F' },
  { img: '/assets/brand/anthropic.svg',name: 'Claude',  color: '#D97757' },
  { img: '/assets/brand/gemini.svg',   name: 'Gemini',  color: '#8AB4F8' },
  { img: '/assets/brand/deepseek.svg', name: 'DeepSeek',color: '#4D6BFE' },
  { img: '/assets/brand/qwen.svg',     name: 'Qwen',    color: '#8B5CF6' },
  { img: '/assets/brand/kimi.svg',     name: 'Kimi',    color: '#7DD3FC' },
  { img: '/assets/brand/zhipu.svg',    name: 'GLM',     color: '#3859FF' },
  { img: '/assets/brand/minimax.svg',  name: 'MiniMax', color: '#F472B6' },
];

const R = 150; // 轨道半径 px
const STEP = 360 / FAMILIES.length;

export default function LandingModelOrbit() {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // 离开视口时暂停动画，省电（用户在意性能）
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => {
      el.classList.toggle('orb-paused', !e.isIntersecting);
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="orb-wrap">
      <div className="orb" ref={ref}>
        <div className="orb-track">
          {FAMILIES.map((f, i) => (
            <div key={f.name} className="orb-slot" style={{ transform: `rotate(${i * STEP}deg)` }}>
              <div className="orb-arm">
                <div className="orb-fix" style={{ transform: `rotate(${-i * STEP}deg)` }}>
                  <div className="orb-keep">
                    <div className="orb-chip" style={{ borderColor: `${f.color}55`, boxShadow: `0 0 22px -6px ${f.color}66, inset 0 0 14px -8px ${f.color}33` }} title={f.name}>
                      <img src={f.img} alt={f.name} loading="lazy" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* 核心：TokUp 光点 */}
        <div className="orb-core">
          <div className="orb-core-mark" />
          <span className="orb-core-name">TokUp</span>
          <span className="orb-core-sub">30+ 主流模型</span>
        </div>
      </div>

      <p className="orb-cap">一个 API Key · 聚合全球主流大模型</p>
      <div className="orb-cta">
        <button className="orb-btn-primary" onClick={() => navigate('/register?mode=register')}>免费注册</button>
        <button className="orb-btn-ghost" onClick={() => navigate('/pricing')}>查看模型与价格</button>
      </div>
    </div>
  );
}
