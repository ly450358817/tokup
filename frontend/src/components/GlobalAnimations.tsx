import { useEffect, useRef } from 'react';

/**
 * 全局动效组件 — 不侵入任何页面逻辑
 * 在页面最底层添加流光粒子、渐变光晕等效果
 */
export default function GlobalAnimations() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
    const PARTICLE_COUNT = 30;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // 初始化粒子
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.3 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制粒子
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${p.alpha})`;
        ctx.fill();

        // 粒子间连线
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x;
          const dy = p.y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(16, 185, 129, ${0.04 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      // 顶部光晕
      const grad1 = ctx.createRadialGradient(canvas.width / 2, 0, 0, canvas.width / 2, 0, canvas.width * 0.4);
      grad1.addColorStop(0, 'rgba(16, 185, 129, 0.018)');
      grad1.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 右下光晕
      const grad2 = ctx.createRadialGradient(canvas.width * 0.85, canvas.height * 0.8, 0, canvas.width * 0.85, canvas.height * 0.8, canvas.width * 0.35);
      grad2.addColorStop(0, 'rgba(20, 184, 166, 0.015)');
      grad2.addColorStop(1, 'rgba(20, 184, 166, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
