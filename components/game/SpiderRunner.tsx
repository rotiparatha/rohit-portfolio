'use client';

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { SpiderGame, type GameMode } from './engine';

export type RunnerHandle = {
  start(): void;
  autopilot(): void;
  takeControl(): void;
  toMenu(): void;
  pause(): void;
  resume(): void;
  setInView(inView: boolean): void;
};

type Props = {
  ref?: Ref<RunnerHandle>;
  onModeChange(mode: GameMode): void;
  onGameOver(score: number, best: number): void;
  className?: string;
};

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
// ArrowDown is left free: it scrolls to the portfolio (handled by the landing page).
const DUCK_KEYS = new Set(['KeyS']);
// On touch screens, a tap on the left part of the game ducks; anywhere else jumps.
const TOUCH_DUCK_ZONE = 0.4;

export default function SpiderRunner({ ref, onModeChange, onGameOver, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<SpiderGame | null>(null);
  const inView = useRef(true);
  const callbacks = useRef({ onModeChange, onGameOver });
  useEffect(() => {
    callbacks.current = { onModeChange, onGameOver };
  });

  useImperativeHandle(ref, () => ({
    start: () => game.current?.start(),
    autopilot: () => game.current?.autopilot(),
    takeControl: () => game.current?.takeControl(),
    toMenu: () => game.current?.toMenu(),
    pause: () => game.current?.pause(),
    resume: () => game.current?.resume(),
    setInView: (v: boolean) => {
      inView.current = v;
      game.current?.setActive(v && !document.hidden);
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const font =
      getComputedStyle(document.documentElement).getPropertyValue('--font-comic').trim() || 'Impact, sans-serif';
    const g = new SpiderGame(canvas, font, {
      onModeChange: (m) => callbacks.current.onModeChange(m),
      onGameOver: (s, b) => callbacks.current.onGameOver(s, b),
    });
    game.current = g;
    document.fonts?.load(`20px ${font}`).catch(() => {});

    const running = () => g.mode === 'playing' || g.mode === 'autopilot' || g.mode === 'paused';
    const typing = (e: Event) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!running() || !inView.current || typing(e)) return;
      if (JUMP_KEYS.has(e.code)) {
        e.preventDefault();
        if (!e.repeat) g.pressJump();
      } else if (DUCK_KEYS.has(e.code)) {
        e.preventDefault();
        g.setDuck(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (JUMP_KEYS.has(e.code)) g.releaseJump();
      if (DUCK_KEYS.has(e.code)) g.setDuck(false);
    };

    let touchDuck = false;
    const onPointerDown = (e: PointerEvent) => {
      if (!running()) return;
      const rect = canvas.getBoundingClientRect();
      if (e.pointerType === 'touch' && g.mode !== 'paused' && e.clientX - rect.left < rect.width * TOUCH_DUCK_ZONE) {
        touchDuck = true;
        g.setDuck(true);
        return;
      }
      g.pressJump();
    };
    // Vertical swipes scroll the page (the canvas allows pan-y), which cancels the pointer.
    const onPointerEnd = () => {
      g.releaseJump();
      if (touchDuck) {
        touchDuck = false;
        g.setDuck(false);
      }
    };
    const onVisibility = () => g.setActive(inView.current && !document.hidden);
    const ro = new ResizeObserver(() => g.resize());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    document.addEventListener('visibilitychange', onVisibility);
    ro.observe(canvas);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      g.destroy();
      game.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-label="Spider-Man runner game" role="img" />;
}
