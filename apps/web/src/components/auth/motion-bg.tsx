import { useEffect, useRef } from 'react';

/**
 * MotionBG — interactive dot-grid canvas that lives behind the auth poster.
 * Renders 18×24 nodes that pulse gently and light up around the cursor.
 * Colors adapt to the current [data-theme] attribute on <html>.
 */
export function MotionBG() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let mouse = { x: -1, y: -1 };
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => {
      mouse = { x: -1, y: -1 };
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    const cols = 18;
    const rows = 24;
    const nodes: { ix: number; iy: number; phase: number }[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        nodes.push({ ix: i, iy: j, phase: Math.random() * Math.PI * 2 });
      }
    }

    const start = performance.now();
    const currentTheme = () => document.documentElement.getAttribute('data-theme') || 'dark';

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      const t = (performance.now() - start) / 1000;
      const isLight = currentTheme() === 'light';
      const base = isLight ? 'rgba(24,24,27,' : 'rgba(255,255,255,';
      const accent = isLight ? 'rgba(212,138,26,' : 'rgba(232,168,56,';

      const stepX = w / (cols - 1);
      const stepY = h / (rows - 1);

      for (const n of nodes) {
        const x = n.ix * stepX;
        const y = n.iy * stepY;
        const wave = Math.sin(t * 0.6 + n.phase + n.ix * 0.3 + n.iy * 0.2) * 0.5 + 0.5;
        let mouseInfluence = 0;
        if (mouse.x > 0) {
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          mouseInfluence = Math.max(0, 1 - d / 180);
        }
        const alpha = 0.05 + wave * 0.08 + mouseInfluence * 0.55;
        const r = 1 + mouseInfluence * 2.2;
        const color = mouseInfluence > 0.2 ? accent : base;
        ctx.fillStyle = color + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full cursor-crosshair"
    />
  );
}
