'use client';

import { useEffect, useRef } from 'react';
import * as D from '@/components/game/draw';

const SCALE = 3;

export default function SpriteSheet() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = 420;
    const H = 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * SCALE * dpr;
    canvas.height = H * SCALE * dpr;
    canvas.style.width = `${W * SCALE}px`;
    canvas.style.height = `${H * SCALE}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(SCALE * dpr, SCALE * dpr);
    ctx.fillStyle = '#bfe9fb';
    ctx.fillRect(0, 0, W, H);
    const showBoxes = new URLSearchParams(window.location.search).has('boxes');

    const ground = (x: number, y: number, w: number) => {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
    };

    const poses: [string, D.SpideyPose][] = [
      ['run 0', D.runPose(0)],
      ['run .25', D.runPose(0.25)],
      ['run .5', D.runPose(0.5)],
      ['run .75', D.runPose(0.75)],
      ['jump web', D.jumpPose(2.3)],
      ['jump', D.jumpPose(null)],
      ['duck', D.duckPose(0)],
      ['hit', D.hitPose()],
    ];
    poses.forEach(([, pose], i) => {
      ctx.save();
      ctx.translate(6 + i * 51, 8);
      ground(-2, D.SPIDEY_H, 50);
      D.drawSpidey(ctx, pose);
      ctx.restore();
    });

    const kinds: D.VillainKind[] = ['ock', 'lizard', 'venom', 'electro', 'goblin'];
    let x = 6;
    for (const kind of kinds) {
      const def = D.VILLAINS[kind];
      const y = 175 - def.h;
      ground(x - 2, 175, def.w + 4);
      D.drawVillain(ctx, kind, x, y, 20);
      if (showBoxes) {
        ctx.strokeStyle = 'rgba(255,0,0,0.9)';
        ctx.lineWidth = 0.6;
        for (const b of D.villainHitboxes(kind)) ctx.strokeRect(x + b.x, y + b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(0,0,255,0.5)';
        ctx.strokeRect(x, y, def.w, def.h);
      }
      x += def.w + 12;
    }

    ctx.save();
    ctx.translate(20, 190);
    D.webLine(ctx, [0, 50], [60, 5]);
    D.starburst(ctx, 140, 30, 30, 16, 12, D.C.yellow, 3);
    D.comicText(ctx, 'THWACK!', 140, 30, 16, D.C.red, getComputedStyle(document.documentElement).getPropertyValue('--font-comic') || 'Impact');
    D.comicText(ctx, 'THWIP!', 230, 30, 14, D.C.yellow, getComputedStyle(document.documentElement).getPropertyValue('--font-comic') || 'Impact', -0.2);
    ctx.restore();
  }, []);

  return <canvas ref={ref} style={{ display: 'block' }} />;
}
