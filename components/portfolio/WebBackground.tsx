'use client';

import { useEffect, useRef } from 'react';
import styles from './Portfolio.module.css';

type P = { x: number; y: number; vx: number; vy: number };
type Splat = { x: number; y: number; born: number };

const LINK = 120;
const REACH = 170;
const SPLAT_MS = 1600;

/**
 * Drifting points joined by silk-like strands. The cursor pulls nearby strands
 * toward it, and a click on empty space throws a small spider web.
 */
export default function WebBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let pts: P[] = [];
    const splats: Splat[] = [];
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;
    let visible = false;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const n = Math.round(Math.min(110, Math.max(28, (W * H) / 15000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
      }));
      if (reduce) draw(performance.now());
    };

    const drawSplat = (s: Splat, now: number) => {
      const age = (now - s.born) / SPLAT_MS;
      const r = 70 * Math.min(1, age * 3);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age) * 0.8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const spokes = 10;
      for (let k = 0; k < spokes; k++) {
        const a = (k / spokes) * Math.PI * 2;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
      }
      for (let ring = 1; ring <= 4; ring++) {
        const rr = (r * ring) / 4;
        for (let k = 0; k <= spokes; k++) {
          const a = (k / spokes) * Math.PI * 2;
          const sag = k % 2 ? 0.9 : 1;
          const x = s.x + Math.cos(a) * rr * sag;
          const y = s.y + Math.sin(a) * rr * sag;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < REACH && d > 30) {
            p.x += (dx / d) * 0.6;
            p.y += (dy / d) * 0.6;
          }
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(170, 190, 230, ${((1 - d / LINK) * 0.28).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        const d = Math.hypot(mouse.x - p.x, mouse.y - p.y);
        if (d < REACH) {
          ctx.strokeStyle = `rgba(255, 92, 97, ${((1 - d / REACH) * 0.75).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(200, 215, 245, 0.55)';
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
      for (let i = splats.length - 1; i >= 0; i--) {
        if (now - splats[i].born > SPLAT_MS) splats.splice(i, 1);
        else drawSplat(splats[i], now);
      }
    };

    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const setRunning = (on: boolean) => {
      cancelAnimationFrame(raf);
      if (on && !reduce) raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      if (reduce && visible) draw(performance.now());
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };
    const onClick = (e: MouseEvent) => {
      if (!visible) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('a, button, input, textarea, select, label')) return;
      const r = canvas.getBoundingClientRect();
      splats.push({ x: e.clientX - r.left, y: e.clientY - r.top, born: performance.now() });
      if (splats.length > 6) splats.shift();
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      setRunning(visible && !document.hidden);
    });
    const onVisibility = () => setRunning(visible && !document.hidden);
    const ro = new ResizeObserver(resize);

    resize();
    ro.observe(canvas);
    io.observe(canvas.parentElement ?? canvas);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('click', onClick);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} className={styles.bg} aria-hidden="true" />;
}
