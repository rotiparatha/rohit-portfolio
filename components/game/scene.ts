// Comic city backdrop: halftone sky, two parallax skyline layers and a rooftop to run on.
// Static layers are pre-rendered to offscreen canvases and scrolled each frame.
import { INK, halftone, type Ctx } from './draw';

const FAR_W = 1100;
const MID_W = 900;
const GROUND_TILE = 240;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function layer(w: number, h: number, res: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * res);
  c.height = Math.ceil(h * res);
  const ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  return [c, ctx];
}

function cloud(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x + 10 * s, y - 2 * s, 10 * s, Math.PI, Math.PI * 1.85);
  ctx.arc(x + 26 * s, y - 8 * s, 13 * s, Math.PI * 1.1, Math.PI * 1.9);
  ctx.arc(x + 44 * s, y - 3 * s, 10 * s, Math.PI * 1.2, Math.PI * 2);
  ctx.lineTo(x + 54 * s, y);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(21,17,15,0.55)';
  ctx.stroke();
}

function waterTower(ctx: Ctx, x: number, roof: number, color: string) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 2, roof);
  ctx.lineTo(x + 3, roof - 8);
  ctx.moveTo(x + 12, roof);
  ctx.lineTo(x + 11, roof - 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, roof - 20, 14, 12);
  ctx.moveTo(x - 1, roof - 20);
  ctx.lineTo(x + 7, roof - 27);
  ctx.lineTo(x + 15, roof - 20);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
}

export class Scene {
  private sky: HTMLCanvasElement;
  private far: HTMLCanvasElement;
  private mid: HTMLCanvasElement;
  private ground: HTMLCanvasElement;

  constructor(
    private W: number,
    private H: number,
    private groundY: number,
    res: number,
  ) {
    this.sky = this.renderSky(res);
    this.far = this.renderFar(res);
    this.mid = this.renderMid(res);
    this.ground = this.renderGround(res);
  }

  private renderSky(res: number) {
    const [c, ctx] = layer(this.W, this.groundY, res);
    const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
    g.addColorStop(0, '#5fc4f2');
    g.addColorStop(0.55, '#a9e3fa');
    g.addColorStop(1, '#ffe7a3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.groundY);
    // halftone dots, bigger toward the top like a printed comic sky
    halftone(ctx, { x: 0, y: 0, w: this.W, h: this.groundY }, 7, (_x, y) => 2.1 * Math.max(0, 1 - y / (this.groundY * 0.8)), 'rgba(20, 95, 170, 0.22)');
    // sun
    const sx = this.W * 0.78;
    const sy = this.groundY * 0.3;
    ctx.beginPath();
    ctx.arc(sx, sy, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3b0';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(21,17,15,0.4)';
    ctx.stroke();
    halftone(ctx, { x: sx - 34, y: sy - 34, w: 68, h: 68 }, 6, (x, y) => (Math.hypot(x - sx, y - sy) < 30 ? 1.3 : 0), 'rgba(255, 190, 40, 0.55)');
    return c;
  }

  private renderFar(res: number) {
    const [c, ctx] = layer(FAR_W, this.groundY, res);
    // Drawn at three offsets with the same seed so shapes crossing an edge wrap seamlessly.
    for (const shift of [-FAR_W, 0, FAR_W]) this.drawFarSet(ctx, shift);
    return c;
  }

  private drawFarSet(ctx: Ctx, shift: number) {
    const rand = rng(7);
    for (let i = 0; i < 5; i++) cloud(ctx, shift + rand() * FAR_W, 30 + rand() * this.groundY * 0.25, 0.8 + rand() * 0.6);
    let x = shift;
    while (x < shift + FAR_W) {
      const w = 40 + rand() * 60;
      const h = 110 + rand() * 170;
      const top = this.groundY - h;
      ctx.beginPath();
      ctx.rect(x, top, w, h);
      const spire = rand();
      if (spire > 0.82) {
        // stepped art-deco top with an antenna
        ctx.rect(x + w * 0.2, top - 18, w * 0.6, 18);
        ctx.rect(x + w * 0.35, top - 32, w * 0.3, 14);
        ctx.moveTo(x + w / 2, top - 32);
        ctx.lineTo(x + w / 2, top - 60);
      } else if (spire > 0.7) {
        ctx.moveTo(x, top);
        ctx.lineTo(x + w / 2, top - 28);
        ctx.lineTo(x + w, top);
      }
      ctx.fillStyle = '#9fb5e8';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(21,17,15,0.45)';
      ctx.stroke();
      halftone(ctx, { x, y: top, w: w * 0.35, h }, 5, () => 1.1, 'rgba(70, 95, 170, 0.35)');
      x += w + 4 + rand() * 18;
    }
  }

  private renderMid(res: number) {
    const [c, ctx] = layer(MID_W, this.groundY, res);
    for (const shift of [-MID_W, 0, MID_W]) this.drawMidSet(ctx, shift);
    return c;
  }

  private drawMidSet(ctx: Ctx, shift: number) {
    const rand = rng(42);
    const colors = ['#4f67bb', '#5b73c8', '#4459a3'];
    let x = shift;
    while (x < shift + MID_W) {
      const w = 50 + rand() * 70;
      const h = 70 + rand() * 120;
      const top = this.groundY - h;
      ctx.beginPath();
      ctx.rect(x, top, w, h);
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      // parapet
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, top, w, 4);
      // windows
      for (let wy = top + 10; wy < this.groundY - 10; wy += 13) {
        for (let wx = x + 7; wx < x + w - 9; wx += 11) {
          ctx.fillStyle = rand() < 0.32 ? '#ffe07a' : '#2c3d7e';
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
      halftone(ctx, { x, y: top, w: w * 0.3, h }, 5, () => 1.2, 'rgba(10, 20, 60, 0.35)');
      if (rand() > 0.55) waterTower(ctx, x + 6 + rand() * (w - 24), top, '#a0643c');
      if (rand() > 0.6) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.7, top);
        ctx.lineTo(x + w * 0.7, top - 16);
        ctx.stroke();
      }
      x += w + 8 + rand() * 26;
    }
  }

  private renderGround(res: number) {
    const h = this.H - this.groundY;
    const [c, ctx] = layer(GROUND_TILE, h, res);
    ctx.fillStyle = '#8f5a41';
    ctx.fillRect(0, 0, GROUND_TILE, h);
    // bricks
    ctx.strokeStyle = 'rgba(21,17,15,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 12, row = 0; y < h; y += 10, row++) {
      ctx.moveTo(0, y);
      ctx.lineTo(GROUND_TILE, y);
      for (let x = row % 2 ? 0 : 12; x < GROUND_TILE; x += 24) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 10);
      }
    }
    ctx.stroke();
    halftone(ctx, { x: 0, y: 12, w: GROUND_TILE, h }, 6, (_x, y) => Math.min(1.6, (y / Math.max(h, 1)) * 2.2), 'rgba(21,17,15,0.25)');
    // ledge
    ctx.fillStyle = '#d39a6a';
    ctx.fillRect(0, 0, GROUND_TILE, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, 1.5, GROUND_TILE, 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x < GROUND_TILE; x += 60) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 9);
    }
    ctx.moveTo(0, 9);
    ctx.lineTo(GROUND_TILE, 9);
    ctx.stroke();
    return c;
  }

  private tile(ctx: Ctx, img: HTMLCanvasElement, tileW: number, offset: number, y: number, h: number) {
    let x = -(((offset % tileW) + tileW) % tileW);
    while (x < this.W) {
      ctx.drawImage(img, x, y, tileW, h);
      x += tileW;
    }
  }

  draw(ctx: Ctx, farX: number, midX: number, groundX: number) {
    ctx.drawImage(this.sky, 0, 0, this.W, this.groundY);
    this.tile(ctx, this.far, FAR_W, farX, 0, this.groundY);
    this.tile(ctx, this.mid, MID_W, midX, 0, this.groundY);
    this.tile(ctx, this.ground, GROUND_TILE, groundX, this.groundY, this.H - this.groundY);
    ctx.fillStyle = INK;
    ctx.fillRect(0, this.groundY - 1.5, this.W, 3);
  }
}
