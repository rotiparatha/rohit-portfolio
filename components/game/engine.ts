// Spider-Man runner: a Chrome-dino-style endless runner on a canvas.
// Units are "logical" pixels; the canvas is scaled so the play area fits the viewport.
import * as D from './draw';
import { Scene } from './scene';

export type GameMode = 'menu' | 'playing' | 'autopilot' | 'over' | 'paused';

export type GameCallbacks = {
  onModeChange?: (mode: GameMode) => void;
  onGameOver?: (score: number, best: number) => void;
};

type Obstacle = { kind: D.VillainKind; x: number; hitBottom: number; t0: number; boxes: D.Box[] };

type Fx = {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  rot: number;
  life: number;
  max: number;
  burst: boolean;
  seed: number;
};

type Web = { ax: number; ay: number };

const SX = 64; // Spider-Man's left edge
const JUMP_V = 13;
const GRAVITY = 0.75;
const HOLD_GRAVITY = 0.52;
const FAST_FALL = 2.4;
const START_SPEED = 6.2;
const MAX_SPEED = 13;
const ACCEL = 0.0011;
// Height of a flyer's hitbox bottom above the rooftop.
const LOW = 8; // jump over
const MID = 40; // duck under
const HIGH = 70; // run under, don't jump
const BEST_KEY = 'rp-spidey-best';

const SPIDEY_BOXES: Record<'run' | 'jump' | 'duck', D.Box[]> = {
  run: [
    { x: 14, y: 4, w: 18, h: 18 },
    { x: 10, y: 20, w: 22, h: 40 },
  ],
  jump: [
    { x: 12, y: 2, w: 20, h: 20 },
    { x: 10, y: 20, w: 26, h: 26 },
  ],
  duck: [{ x: 10, y: 32, w: 40, h: 28 }],
};

function overlap(a: D.Box, b: D.Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    // storage unavailable (private mode); best score just isn't remembered
  }
}

export class SpiderGame {
  mode: GameMode = 'menu';

  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private s = 1;
  private W = 600;
  private H = 450;
  private groundY = 380;
  private scene!: Scene;
  private raf = 0;
  private last = 0;
  private active = true;
  private t = 0;

  private speed = START_SPEED;
  private score = 0;
  private best = 0;
  private farX = 0;
  private midX = 0;
  private groundX = 0;
  private nextGap = 0;
  private runDistance = 0;
  private lastKind: D.VillainKind | null = null;
  private shake = 0;

  private sp = { y: 0, vy: 0, onGround: true, jumpHeld: false, ducking: false, phase: 0, web: null as Web | null, hit: false };
  private obstacles: Obstacle[] = [];
  private fx: Fx[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private font: string,
    private cb: GameCallbacks = {},
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.best = readBest();
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------- public controls ----------

  start() {
    this.reset();
    this.setMode('playing');
  }

  autopilot() {
    this.reset();
    this.setMode('autopilot');
  }

  /** Hand control to the visitor mid-run (from autopilot). */
  takeControl() {
    if (this.mode === 'autopilot') this.setMode('playing');
  }

  toMenu() {
    this.reset();
    this.setMode('menu');
  }

  pressJump() {
    if (this.mode === 'paused') return this.resume();
    if (this.mode === 'autopilot') this.takeControl();
    if (this.mode === 'playing') this.jump(true);
  }

  /** Freezes a run (e.g. when the visitor scrolls away mid-game). */
  pause() {
    if (this.mode !== 'playing') return;
    this.sp.jumpHeld = false;
    this.sp.ducking = false;
    this.setMode('paused');
  }

  resume() {
    if (this.mode === 'paused') this.setMode('playing');
  }

  releaseJump() {
    this.sp.jumpHeld = false;
  }

  setDuck(on: boolean) {
    if (this.mode === 'autopilot' && on) this.takeControl();
    if (this.mode === 'playing' || this.mode === 'autopilot') this.sp.ducking = on;
  }

  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    if (active) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.frame);
    } else {
      cancelAnimationFrame(this.raf);
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const vw = Math.max(1, rect.width);
    const vh = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.s = Math.min(vh / 450, vw / 600);
    this.W = vw / this.s;
    this.H = vh / this.s;
    this.groundY = Math.round(Math.min(this.H - 70, this.H * 0.5 + 160));
    this.canvas.width = Math.round(vw * this.dpr);
    this.canvas.height = Math.round(vh * this.dpr);
    this.scene = new Scene(this.W, this.H, this.groundY, Math.min(this.s * this.dpr, 2.5));
    if (!this.active) this.render();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.active = false;
  }

  // ---------- internals ----------

  private setMode(mode: GameMode) {
    this.mode = mode;
    this.cb.onModeChange?.(mode);
  }

  private reset() {
    this.speed = START_SPEED;
    this.score = 0;
    this.obstacles = [];
    this.fx = [];
    this.shake = 0;
    this.lastKind = null;
    this.runDistance = 0;
    this.nextGap = 0;
    // drop in from a web line, as if swinging into the run
    this.sp = { y: 150, vy: 0, onGround: false, jumpHeld: false, ducking: false, phase: 0, web: { ax: SX + 40, ay: -10 }, hit: false };
  }

  private frame = (now: number) => {
    if (!this.active) return;
    const dt = this.last ? Math.min(3, (now - this.last) / (1000 / 60)) : 1;
    this.last = now;
    // sub-step so fast runs can't tunnel through thin villains
    const steps = Math.ceil(dt);
    for (let i = 0; i < steps; i++) this.update(dt / steps);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  private jump(hold: boolean) {
    const sp = this.sp;
    if (!sp.onGround) return;
    sp.vy = JUMP_V;
    sp.onGround = false;
    sp.jumpHeld = hold;
    const ay = Math.max(12, this.groundY - 300 - Math.random() * 40);
    const ax = SX + 150 + Math.random() * 70;
    sp.web = { ax, ay };
    this.addText('THWIP!', (SX + 30 + ax) / 2 + 10, (this.groundY - 70 + ay) / 2, 15, D.C.white, -0.25);
  }

  private addText(text: string, x: number, y: number, size: number, color: string, rot = 0, life = 34, burst = false) {
    this.fx.push({ text, x, y, size, color, rot, life, max: life, burst, seed: Math.random() * 10 });
  }

  private obstacleTop(o: Obstacle): number {
    const def = D.VILLAINS[o.kind];
    if (def.ground) return this.groundY - def.h;
    const boxBottom = Math.max(...def.hitboxes.map((b) => b.y + b.h));
    return this.groundY - o.hitBottom - boxBottom;
  }

  private spawn() {
    const pool: D.VillainKind[] = ['ock', 'lizard'];
    if (this.score > 60) pool.push('venom');
    if (this.score > 110) pool.push('electro', 'goblin');
    let kind = pool[Math.floor(Math.random() * pool.length)];
    if (kind === this.lastKind) kind = pool[Math.floor(Math.random() * pool.length)];
    this.lastKind = kind;
    const def = D.VILLAINS[kind];
    let hitBottom = 0;
    if (!def.ground) {
      const r = Math.random();
      hitBottom = this.score < 300 ? (r < 0.5 ? LOW : MID) : r < 0.34 ? LOW : r < 0.67 ? MID : HIGH;
    }
    this.obstacles.push({ kind, x: this.W + 10, hitBottom, t0: Math.random() * 100, boxes: D.villainHitboxes(kind) });
    const minGap = 200 + this.speed * 24;
    this.nextGap = minGap + Math.random() * minGap * 0.9;
  }

  private spideyState(): 'run' | 'jump' | 'duck' {
    if (!this.sp.onGround) return 'jump';
    return this.sp.ducking ? 'duck' : 'run';
  }

  private spideyTop() {
    return this.groundY - D.SPIDEY_H - this.sp.y;
  }

  private hits(o: Obstacle): boolean {
    const top = this.spideyTop();
    const ot = this.obstacleTop(o);
    for (const sb of SPIDEY_BOXES[this.spideyState()]) {
      const a = { x: SX + sb.x, y: top + sb.y, w: sb.w, h: sb.h };
      for (const ob of o.boxes) if (overlap(a, { x: o.x + ob.x, y: ot + ob.y, w: ob.w, h: ob.h })) return true;
    }
    return false;
  }

  private drive() {
    // Autopilot: jump so the arc peaks over each ground villain, duck under mid flyers.
    const next = this.obstacles.find((o) => o.x + D.VILLAINS[o.kind].w > SX + 4);
    if (!next) {
      this.sp.ducking = false;
      return;
    }
    const def = D.VILLAINS[next.kind];
    const dist = next.x - (SX + 36);
    if (!def.ground && next.hitBottom === MID) {
      this.sp.ducking = dist < this.speed * 10;
      return;
    }
    this.sp.ducking = false;
    if (!def.ground && next.hitBottom === HIGH) return;
    const framesToCenter = (next.x + def.w / 2 - (SX + 23)) / this.speed;
    if (this.sp.onGround && framesToCenter > 0 && framesToCenter <= JUMP_V / GRAVITY + 1) this.jump(false);
  }

  private gameOver(o: Obstacle) {
    this.sp.hit = true;
    this.sp.web = null;
    this.shake = 16;
    const final = Math.floor(this.score);
    if (final > this.best) {
      this.best = final;
      writeBest(final);
    }
    this.addText(D.VILLAINS[o.kind].sound, SX + 34, this.spideyTop() + 18, 22, D.C.red, -0.12, 1e9, true);
    this.setMode('over');
    this.cb.onGameOver?.(final, this.best);
  }

  private update(dt: number) {
    this.t += dt;
    for (const f of this.fx) f.life -= dt;
    this.fx = this.fx.filter((f) => f.life > 0);

    if (this.mode === 'menu') {
      this.farX += 0.25 * dt;
      this.midX += 0.6 * dt;
      this.groundX += 1.4 * dt;
      return;
    }
    if (this.mode === 'over') {
      this.shake = Math.max(0, this.shake - dt);
      return;
    }
    if (this.mode === 'paused') return;

    this.speed = Math.min(MAX_SPEED, this.speed + ACCEL * dt);
    const dx = this.speed * dt;
    this.groundX += dx;
    this.midX += dx * 0.42;
    this.farX += dx * 0.16;
    this.runDistance += dx;
    const before = Math.floor(this.score / 100);
    this.score += dx * 0.025;
    if (Math.floor(this.score / 100) > before) {
      this.addText(`${Math.floor(this.score / 100) * 100}!`, this.W - 70, 54, 17, D.C.yellow, 0.1, 50);
    }

    if (this.mode === 'autopilot') this.drive();

    const sp = this.sp;
    sp.phase = (sp.phase + dt * this.speed * 0.0085) % 1;
    if (!sp.onGround) {
      const g = sp.ducking ? FAST_FALL : sp.jumpHeld && sp.vy > 0 ? HOLD_GRAVITY : GRAVITY;
      sp.y += sp.vy * dt;
      sp.vy -= g * dt;
      if (sp.y <= 0) {
        sp.y = 0;
        sp.vy = 0;
        sp.onGround = true;
        sp.web = null;
      }
    }
    if (sp.web) {
      sp.web.ax -= dx;
      if (sp.web.ax < SX + 8 || sp.vy < -5) sp.web = null;
    }

    for (const o of this.obstacles) o.x -= dx;
    this.obstacles = this.obstacles.filter((o) => o.x + D.VILLAINS[o.kind].w > -30);
    // First villain only after a short warm-up (~2.5 s until it reaches Spider-Man).
    const lastObs = this.obstacles[this.obstacles.length - 1];
    const due = lastObs ? this.W - (lastObs.x + D.VILLAINS[lastObs.kind].w) >= this.nextGap : this.runDistance >= 320;
    if (due) this.spawn();

    for (const o of this.obstacles) {
      if (this.hits(o)) {
        this.gameOver(o);
        return;
      }
    }
  }

  private pose(): { pose: D.SpideyPose; webAngle: number | null } {
    const sp = this.sp;
    if (sp.hit) return { pose: D.hitPose(), webAngle: null };
    const state = this.spideyState();
    if (state === 'duck') return { pose: D.duckPose(sp.phase), webAngle: null };
    if (state === 'jump') {
      let webAngle: number | null = null;
      if (sp.web) {
        const shX = SX + 25;
        const shY = this.spideyTop() + 18;
        webAngle = Math.atan2(sp.web.ax - shX, sp.web.ay - shY);
      }
      return { pose: D.jumpPose(webAngle), webAngle };
    }
    return { pose: D.runPose(sp.phase), webAngle: null };
  }

  private drawSpidey(ctx: CanvasRenderingContext2D) {
    if (this.mode === 'menu') {
      // hanging upside down from a web, swaying
      const ax = Math.min(this.W - 60, this.W * 0.5 + 250);
      const rope = Math.max(90, this.groundY * 0.4);
      const sway = Math.sin(this.t * 0.03) * 0.09;
      const endX = ax + Math.sin(-sway) * rope;
      const endY = Math.cos(sway) * rope;
      D.webLine(ctx, [endX, endY], [ax, -6]);
      ctx.save();
      ctx.translate(endX, endY);
      ctx.rotate(Math.PI + sway);
      ctx.translate(-23, -D.SPIDEY_H + 4);
      D.drawSpidey(ctx, D.hangPose(this.t * 0.01));
      ctx.restore();
      return;
    }
    const { pose } = this.pose();
    const top = this.spideyTop();
    ctx.save();
    ctx.translate(SX, top);
    const hand = D.drawSpidey(ctx, pose);
    ctx.restore();
    if (this.sp.web && !this.sp.hit) D.webLine(ctx, [SX + hand[0], top + hand[1]], [this.sp.web.ax, this.sp.web.ay]);
  }

  private render() {
    const ctx = this.ctx;
    const k = this.s * this.dpr;
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.7 : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.7 : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, sx * k, sy * k);
    this.scene.draw(ctx, this.farX, this.midX, this.groundX);

    // speed lines once the run gets fast
    if ((this.mode === 'playing' || this.mode === 'autopilot') && this.speed > 9) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const y = 40 + ((i * 53 + Math.floor(this.t) * 7) % Math.max(60, this.groundY - 120));
        const x = this.W - ((this.t * this.speed * 3 + i * 170) % (this.W + 200));
        ctx.moveTo(x, y);
        ctx.lineTo(x + 60 + (i % 3) * 30, y);
      }
      ctx.stroke();
    }

    for (const o of this.obstacles) D.drawVillain(ctx, o.kind, o.x, this.obstacleTop(o), this.t + o.t0);
    this.drawSpidey(ctx);

    for (const f of this.fx) {
      const age = f.max - f.life;
      const pop = 1 + 0.35 * Math.max(0, 1 - age / 6);
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life / 10);
      if (f.burst) {
        D.starburst(ctx, f.x, f.y, 40 * pop, 22 * pop, 12, D.C.yellow, f.seed);
        D.starburst(ctx, f.x, f.y, 26 * pop, 16 * pop, 9, '#ffffff', f.seed + 3, 2);
      }
      D.comicText(ctx, f.text, f.x, f.y, f.size * pop, f.color, this.font, f.rot);
      ctx.restore();
    }

    if (this.mode !== 'menu') {
      const pad = (n: number) => String(Math.floor(n)).padStart(5, '0');
      ctx.save();
      ctx.globalAlpha = 0.9;
      D.comicText(ctx, `HI ${pad(this.best)}`, this.W - 150, 26, 17, '#ffe9a3', this.font);
      D.comicText(ctx, pad(this.score), this.W - 60, 26, 20, D.C.white, this.font);
      ctx.restore();
    }
  }
}
