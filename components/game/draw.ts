// Comic-style canvas drawing: thick ink outlines, flat colours, halftone dots.
// All characters are original fan-art drawn with paths, in logical units.

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];
export type Box = { x: number; y: number; w: number; h: number };

export const INK = '#15110f';

export const C = {
  red: '#e2262d',
  redDark: '#a5161c',
  blue: '#2556cf',
  blueDark: '#183a8f',
  white: '#ffffff',
  yellow: '#ffd60a',
  orange: '#ff8a1c',
  skin: '#f2c38f',
  metal: '#aeb8c6',
  metalLight: '#e8eef5',
  ockGreen: '#2f8a3c',
  ockGreenDark: '#1f6029',
  hair: '#5a3418',
  lizard: '#45b04f',
  lizardDark: '#2a7c34',
  coat: '#f3f2ec',
  purple: '#7a2fb0',
  purpleDark: '#55207d',
  venom: '#16161e',
  venomSheen: '#5677c4',
  tongue: '#e8497f',
  mouth: '#5d0c1b',
  electro: '#2fa84f',
  electroDark: '#1f7a37',
  goblin: '#63b83a',
  goblinDark: '#3f8a22',
  glider: '#3a3f4c',
  gliderLight: '#69728a',
};

// ---------- primitives ----------

const dir = (a: number): Pt => [Math.sin(a), Math.cos(a)]; // 0 = straight down, + = toward +x
const add = (p: Pt, d: Pt, k: number): Pt => [p[0] + d[0] * k, p[1] + d[1] * k];
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function trace(ctx: Ctx, pts: Pt[], close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

export function inked(ctx: Ctx, fill: string, lw = 2.2) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

export function poly(ctx: Ctx, pts: Pt[], fill: string, lw = 2.2) {
  trace(ctx, pts);
  inked(ctx, fill, lw);
}

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, lw = 2.2, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  inked(ctx, fill, lw);
}

/** Thick outlined limb; each segment can have its own colour (e.g. blue leg, red boot). */
export function limb(ctx: Ctx, pts: Pt[], width: number, colors: string[]) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  trace(ctx, pts, false);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 3.4;
  ctx.stroke();
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    ctx.strokeStyle = colors[Math.min(i, colors.length - 1)];
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Tube along a curve that tapers from w0 to w1 (tails, tongues, tentacle tips). */
function taper(ctx: Ctx, pts: Pt[], w0: number, w1: number, fill: string, lw = 2) {
  const leftSide: Pt[] = [];
  const rightSide: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    leftSide.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    rightSide.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  poly(ctx, [...leftSide, ...rightSide.reverse()], fill, lw);
}

/** Segmented metal tentacle with a three-prong claw. */
function tentacle(ctx: Ctx, p0: Pt, p1: Pt, p2: Pt, p3: Pt, open: number) {
  const pts = cubic(p0, p1, p2, p3, 18);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  trace(ctx, pts, false);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8.4;
  ctx.stroke();
  ctx.strokeStyle = C.metal;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = C.metalLight;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // segment rings
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  for (let i = 2; i < pts.length - 1; i += 2) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const a = Math.atan2(ny - y, nx - x) + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6);
    ctx.lineTo(x - Math.cos(a) * 2.6, y - Math.sin(a) * 2.6);
    ctx.stroke();
  }
  // claw
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 3];
  const heading = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  for (const k of [-1, 0, 1]) {
    const a = heading + k * (0.35 + open * 0.45);
    const tip: Pt = [end[0] + Math.cos(a) * 5.5, end[1] + Math.sin(a) * 5.5];
    limb(ctx, [end, tip], 1.8, [C.metal]);
  }
}

export function halftone(ctx: Ctx, area: Box, spacing: number, radiusAt: (x: number, y: number) => number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let y = area.y; y < area.y + area.h; y += spacing) {
    const offset = (Math.round((y - area.y) / spacing) % 2) * (spacing / 2);
    for (let x = area.x + offset; x < area.x + area.w; x += spacing) {
      const r = radiusAt(x, y);
      if (r <= 0.05) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

export function starburst(ctx: Ctx, x: number, y: number, rOuter: number, rInner: number, spikes: number, fill: string, seed = 1, lw = 3) {
  const pts: Pt[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + seed * 0.37;
    const jitter = 0.82 + 0.3 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233));
    const r = i % 2 === 0 ? rOuter * jitter : rInner;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  poly(ctx, pts, fill, lw);
}

export function comicText(ctx: Ctx, text: string, x: number, y: number, size: number, fill: string, font: string, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.fillStyle = INK;
  ctx.fillText(text, size * 0.07, size * 0.07);
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ---------- Spider-Man (faces right; box 46 x 62, feet on y = 62) ----------

export type SpideyPose = {
  hip: Pt;
  lean: number; // torso angle from vertical, + leans forward
  legF: [number, number]; // [thigh, shin] absolute angles, 0 = down, + = forward
  legB: [number, number];
  armF: [number, number]; // [upper arm, forearm]
  armB: [number, number];
  headTilt?: number;
};

export const SPIDEY_W = 46;
export const SPIDEY_H = 62;

export function runPose(phase: number): SpideyPose {
  const a = phase * Math.PI * 2;
  const leg = (p: number): [number, number] => {
    const thigh = 0.85 * Math.sin(p);
    return [thigh, thigh - 0.15 - 1.45 * Math.max(0, Math.cos(p))];
  };
  const arm = (p: number): [number, number] => {
    const upper = 0.8 * Math.sin(p);
    return [upper, upper + 1.55];
  };
  return {
    hip: [21, 34.6 - 1.4 * Math.abs(Math.sin(a))],
    lean: 0.3,
    legF: leg(a),
    legB: leg(a + Math.PI),
    armF: arm(a + Math.PI),
    armB: arm(a),
  };
}

export function jumpPose(webAngle: number | null): SpideyPose {
  return {
    hip: [21, 33],
    lean: 0.18,
    legF: [1.3, 0.15],
    legB: [-0.3, -1.55],
    armF: webAngle === null ? [2.5, 2.7] : [webAngle, webAngle],
    armB: [-0.95, -0.15],
    headTilt: webAngle === null ? 0 : -0.15,
  };
}

export function duckPose(phase: number): SpideyPose {
  const wobble = Math.sin(phase * Math.PI * 2) * 0.12;
  return {
    hip: [15, 45.5],
    lean: 1.18,
    legF: [1.45 + wobble, -0.05],
    legB: [-0.35 - wobble, -1.45],
    armF: [0.32, 0.02],
    armB: [-1.5, -0.8],
    headTilt: -0.95,
  };
}

export function hitPose(): SpideyPose {
  return {
    hip: [22, 34],
    lean: -0.45,
    legF: [0.7, 1.1],
    legB: [-0.45, -0.15],
    armF: [2.6, 3.0],
    armB: [-2.5, -2.9],
    headTilt: 0.35,
  };
}

export function hangPose(phase: number): SpideyPose {
  const s = Math.sin(phase * Math.PI * 2) * 0.08;
  return {
    hip: [23, 37],
    lean: 0,
    legF: [0.12 + s, 0.04 + s],
    legB: [-0.1 + s, -0.02 + s],
    armF: [0.5, 1.4],
    armB: [-0.5, -1.4],
  };
}

function spideyHead(ctx: Ctx, c: Pt, tilt: number) {
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.rotate(tilt);
  ctx.scale(1.1, 1.1);
  oval(ctx, 0, 0, 8.6, 10, C.red, 2.3);
  // web pattern, clipped to the mask
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.6, 10, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.65;
  const fx = 3.5;
  const fy = 1.5;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + Math.cos(a) * 18, fy + Math.sin(a) * 18);
  }
  for (const r of [4, 7.5, 11.5, 15.5]) {
    ctx.moveTo(fx + r, fy);
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
  // far eye (just a sliver at the front edge) and near eye
  trace(ctx, [[6.4, -4.6], [9.3, -3.2], [9.1, 0.6], [7.2, 0.4]]);
  inked(ctx, C.white, 1.8);
  ctx.beginPath();
  ctx.moveTo(-0.6, -4.2);
  ctx.quadraticCurveTo(4.6, -8.2, 6.9, -2.2);
  ctx.quadraticCurveTo(6.4, 2.4, 1.2, 1.4);
  ctx.quadraticCurveTo(-1.6, -0.6, -0.6, -4.2);
  inked(ctx, C.white, 2.4);
  ctx.restore();
}

function spideyTorso(ctx: Ctx, hip: Pt, sh: Pt, nrm: Pt) {
  const fH = add(hip, nrm, 6.4);
  const bH = add(hip, nrm, -6.4);
  const fS = add(sh, nrm, 8);
  const bS = add(sh, nrm, -7.4);
  poly(ctx, [bH, fH, fS, bS], C.red, 0);
  // blue side panel on the back half
  poly(ctx, [bH, add(hip, nrm, -1.2), add(sh, nrm, -2.6), bS], C.blue, 0);
  // belt line + chest emblem
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(...lerp(fH, bH, 0));
  ctx.lineTo(...bH);
  ctx.stroke();
  const chest = add(lerp(hip, sh, 0.66), nrm, 2.6);
  ctx.save();
  ctx.translate(chest[0], chest[1]);
  ctx.rotate(Math.atan2(nrm[1], nrm[0]));
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.3, 2.1, Math.PI / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(-1, 0);
    ctx.lineTo(-3.4, s * 2.6);
    ctx.moveTo(1, 0);
    ctx.lineTo(3.2, s * 2.4);
  }
  ctx.stroke();
  ctx.restore();
  trace(ctx, [bH, fH, fS, bS]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** Draws Spider-Man; returns the hand position (where a web line starts). */
export function drawSpidey(ctx: Ctx, pose: SpideyPose): Pt {
  const T = 17;
  const hip = pose.hip;
  const up: Pt = [Math.sin(pose.lean), -Math.cos(pose.lean)];
  const nrm: Pt = [Math.cos(pose.lean), Math.sin(pose.lean)];
  const sh = add(hip, up, T);
  const head = add(add(sh, up, 9.8), nrm, 1.6);
  const leg = ([thigh, shin]: [number, number]): Pt[] => {
    const knee = add(hip, dir(thigh), 12);
    const foot = add(knee, dir(shin), 12.6);
    return [hip, knee, lerp(knee, foot, 0.5), foot];
  };
  const arm = ([upper, fore]: [number, number], side: number): Pt[] => {
    const s = add(sh, nrm, side);
    const elbow = add(s, dir(upper), 9.4);
    return [s, elbow, add(elbow, dir(fore), 9.6)];
  };

  limb(ctx, leg(pose.legB), 6.2, [C.blueDark, C.blueDark, C.redDark]);
  limb(ctx, arm(pose.armB, -2), 5, [C.redDark, C.redDark]);
  spideyTorso(ctx, hip, sh, nrm);
  spideyHead(ctx, head, pose.lean * 0.55 + (pose.headTilt ?? 0));
  limb(ctx, leg(pose.legF), 6.6, [C.blue, C.blue, C.red]);
  const front = arm(pose.armF, 2);
  limb(ctx, front, 5.4, [C.red, C.red]);
  return front[2];
}

// ---------- villains (drawn facing right, flipped to face Spider-Man) ----------

export type VillainKind = 'ock' | 'lizard' | 'venom' | 'electro' | 'goblin';

export type VillainDef = {
  w: number;
  h: number;
  ground: boolean;
  hitboxes: Box[]; // in the right-facing drawing's coordinates
  sound: string;
};

export const VILLAINS: Record<VillainKind, VillainDef> = {
  ock: {
    w: 76,
    h: 76,
    ground: true,
    hitboxes: [
      { x: 28, y: 6, w: 22, h: 44 },
      { x: 14, y: 50, w: 48, h: 26 },
    ],
    sound: 'WHAM!',
  },
  lizard: {
    w: 58,
    h: 68,
    ground: true,
    hitboxes: [
      { x: 32, y: 8, w: 22, h: 16 },
      { x: 20, y: 22, w: 22, h: 46 },
      { x: 6, y: 54, w: 16, h: 12 },
    ],
    sound: 'SKRAAA!',
  },
  venom: {
    w: 66,
    h: 80,
    ground: true,
    hitboxes: [
      { x: 16, y: 14, w: 44, h: 40 },
      { x: 14, y: 52, w: 30, h: 28 },
    ],
    sound: 'CHOMP!',
  },
  electro: {
    w: 62,
    h: 46,
    ground: false,
    hitboxes: [{ x: 6, y: 13, w: 50, h: 20 }],
    sound: 'ZZZAP!',
  },
  goblin: {
    w: 76,
    h: 52,
    ground: false,
    hitboxes: [
      { x: 32, y: 4, w: 16, h: 28 },
      { x: 6, y: 34, w: 62, h: 11 },
    ],
    sound: 'KA-BOOM!',
  },
};

/** Hitboxes in screen orientation (the drawing is mirrored to face left). */
export function villainHitboxes(kind: VillainKind): Box[] {
  const d = VILLAINS[kind];
  return d.hitboxes.map((b) => ({ x: d.w - (b.x + b.w), y: b.y, w: b.w, h: b.h }));
}

function drawOck(ctx: Ctx, t: number) {
  const s = Math.sin(t * 0.09);
  const step = Math.sin(t * 0.18) * 2;
  // upper arms (tentacles) behind the body
  tentacle(ctx, [33, 33], [16, 26], [4, 14 + s * 4], [12, 3 + s * 3], 0.5 + 0.5 * s);
  tentacle(ctx, [44, 33], [62, 24], [74, 12 - s * 4], [66, 2 - s * 3], 0.5 - 0.5 * s);
  // lower tentacles act as legs
  tentacle(ctx, [34, 45], [24, 50], [12, 56], [8 + step, 69], 0.2);
  tentacle(ctx, [43, 45], [54, 50], [66, 56], [70 - step, 69], 0.2);
  // dangling legs
  limb(ctx, [[35, 46], [33, 55], [31, 61]], 5.5, [C.ockGreenDark, C.ockGreenDark]);
  limb(ctx, [[42, 46], [44, 55], [46, 61]], 5.5, [C.ockGreen, C.ockGreen]);
  oval(ctx, 30.5, 62, 3.6, 2, INK, 0);
  oval(ctx, 47, 62, 3.6, 2, INK, 0);
  // body + harness
  poly(ctx, [[27, 20], [49, 20], [47, 44], [30, 44]], C.ockGreen);
  poly(ctx, [[29, 39], [48, 39], [48, 46], [29, 46]], C.metal, 2);
  for (const x of [32, 38.5, 45]) oval(ctx, x, 42.5, 1.3, 1.3, INK, 0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(38, 21);
  ctx.lineTo(38, 38);
  ctx.stroke();
  // arms with fists
  limb(ctx, [[29, 23], [24, 32], [28, 38]], 5, [C.ockGreenDark, C.ockGreenDark]);
  limb(ctx, [[47, 23], [53, 31], [50, 37]], 5, [C.ockGreen, C.ockGreen]);
  oval(ctx, 28.5, 38.5, 2.8, 2.8, C.skin, 1.8);
  oval(ctx, 50, 37.5, 2.8, 2.8, C.skin, 1.8);
  // head: bowl cut + goggles
  oval(ctx, 39, 11, 8.6, 9, C.skin, 2.4);
  ctx.beginPath();
  ctx.moveTo(30.2, 11);
  ctx.bezierCurveTo(29, 0, 48, -1.5, 47.8, 8.5);
  ctx.lineTo(42, 7.4);
  ctx.lineTo(30.6, 12.8);
  ctx.closePath();
  inked(ctx, C.hair, 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(38, 11.5);
  ctx.lineTo(48, 11);
  ctx.stroke();
  oval(ctx, 41.2, 11.6, 3, 3, INK, 0);
  oval(ctx, 46.2, 11.3, 2.6, 2.8, INK, 0);
  oval(ctx, 40.2, 10.6, 0.9, 0.9, C.white, 0);
  oval(ctx, 45.4, 10.4, 0.8, 0.8, C.white, 0);
  ctx.beginPath();
  ctx.moveTo(41.5, 16.6);
  ctx.quadraticCurveTo(44.5, 15.2, 46.5, 16.8);
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

function drawLizard(ctx: Ctx, t: number) {
  const sway = Math.sin(t * 0.12);
  // tail
  taper(ctx, cubic([24, 46], [10, 48 + sway * 2], [2, 58], [12 + sway * 3, 66], 14), 9, 1.5, C.lizardDark, 2.2);
  // back leg
  limb(ctx, [[25, 46], [19, 55], [22, 62], [16, 67]], 6, [C.purpleDark, C.lizardDark, C.lizardDark]);
  // back arm
  limb(ctx, [[33, 27], [40, 36], [47, 33]], 4.6, [C.lizardDark, C.lizardDark]);
  // torso (scaly) under the coat
  poly(ctx, [[22, 44], [30, 47], [42, 26], [34, 20]], C.lizard);
  // lab coat with a torn hem
  poly(
    ctx,
    [[33, 19], [42, 25], [36, 40], [33, 52], [30, 49], [27, 54], [24, 50], [20, 53], [20, 44], [26, 30]],
    C.coat,
    2.2,
  );
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(35, 23);
  ctx.lineTo(29, 38);
  ctx.moveTo(38, 25);
  ctx.lineTo(32, 33);
  ctx.stroke();
  // front leg: purple trousers, green clawed foot
  limb(ctx, [[28, 47], [35, 55], [30, 62], [38, 67]], 6.4, [C.purple, C.lizard, C.lizard]);
  for (const k of [0, 1, 2]) limb(ctx, [[38, 67], [42 + k * 1.5, 66 + k * 0.6]], 1.3, [C.white]);
  // head: long snout, open jaw, yellow slit eye
  limb(ctx, [[36, 22], [40, 16]], 7, [C.lizard]);
  poly(ctx, [[35, 15], [39, 7], [47, 6.5], [56, 12], [57, 15.5], [52, 17.5], [44, 17.5], [38, 19]], C.lizard);
  poly(ctx, [[44, 17.5], [54, 18.5], [52, 22], [42, 22.5]], C.lizardDark, 2);
  poly(ctx, [[45, 18], [53, 18.6], [51.5, 20.8], [44, 21]], C.mouth, 0);
  ctx.fillStyle = C.white;
  ctx.beginPath();
  for (let x = 45; x < 53; x += 2) {
    ctx.moveTo(x, 17.6);
    ctx.lineTo(x + 1, 19.6);
    ctx.lineTo(x + 2, 17.6);
    ctx.moveTo(x, 21.4);
    ctx.lineTo(x + 1, 19.8);
    ctx.lineTo(x + 2, 21.2);
  }
  ctx.fill();
  oval(ctx, 46, 10.6, 2.8, 2.1, C.yellow, 1.6);
  oval(ctx, 46.4, 10.6, 0.6, 1.8, INK, 0);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(54.5, 13.2, 0.7, 0, Math.PI * 2);
  ctx.fill();
  // scales
  ctx.strokeStyle = C.lizardDark;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const [x, y] of [[40, 9], [43, 13], [50, 10], [37, 13]] as Pt[]) {
    ctx.moveTo(x - 1.5, y);
    ctx.arc(x, y, 1.5, Math.PI, 0);
  }
  ctx.stroke();
  // front arm with claws, reaching forward
  limb(ctx, [[37, 26], [45, 33], [53, 29 + sway]], 5, [C.lizard, C.lizard]);
  for (const k of [-1, 0, 1]) limb(ctx, [[53, 29 + sway], [57, 27 + sway + k * 2]], 1.2, [C.white]);
}

function drawVenom(ctx: Ctx, t: number) {
  const breathe = Math.sin(t * 0.1);
  // back leg + arm
  limb(ctx, [[24, 54], [17, 66], [21, 74]], 9, [C.venom, C.venom]);
  limb(ctx, [[26, 26], [17, 40], [24, 52]], 8, [C.venom, C.venom]);
  // hulking torso
  poly(ctx, [[13, 40], [18, 23], [33, 15], [49, 21], [55, 36], [48, 51], [24, 56]], C.venom, 2.6);
  // comic sheen
  ctx.strokeStyle = C.venomSheen;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(20, 26);
  ctx.quadraticCurveTo(27, 19, 35, 19);
  ctx.moveTo(17, 36);
  ctx.quadraticCurveTo(19, 31, 22, 29);
  ctx.moveTo(26, 52);
  ctx.quadraticCurveTo(33, 53, 40, 51);
  ctx.stroke();
  // white spider emblem
  ctx.beginPath();
  ctx.moveTo(44, 33);
  ctx.quadraticCurveTo(38, 24, 26, 22);
  ctx.quadraticCurveTo(36, 28, 40, 34);
  ctx.quadraticCurveTo(34, 38, 25, 46);
  ctx.quadraticCurveTo(37, 42, 44, 37);
  ctx.quadraticCurveTo(48, 44, 46, 51);
  ctx.quadraticCurveTo(52, 43, 48, 35);
  ctx.quadraticCurveTo(53, 29, 50, 22);
  ctx.quadraticCurveTo(48, 29, 44, 33);
  inked(ctx, C.white, 1.4);
  // front leg
  limb(ctx, [[33, 54], [41, 65], [37, 74]], 9.5, [C.venom, C.venom]);
  oval(ctx, 39, 76.5, 6.5, 2.6, C.venom, 2);
  // head, hunched forward
  ctx.beginPath();
  ctx.moveTo(41, 23);
  ctx.bezierCurveTo(40, 8, 60, 6, 63, 18);
  ctx.bezierCurveTo(65, 26, 60, 33, 52, 33);
  ctx.bezierCurveTo(45, 33, 41, 29, 41, 23);
  inked(ctx, C.venom, 2.6);
  // jagged eyes
  poly(ctx, [[48, 13], [59, 12.5], [62.5, 19.5], [57, 18], [52, 19.5]], C.white, 1.8);
  // grin with teeth
  poly(ctx, [[44, 24], [63, 22.5], [61, 30], [47, 30]], C.mouth, 2);
  ctx.fillStyle = C.white;
  ctx.beginPath();
  for (let x = 45; x < 62; x += 2.2) {
    ctx.moveTo(x, 23.7);
    ctx.lineTo(x + 1.1, 27.2);
    ctx.lineTo(x + 2.2, 23.5);
    ctx.moveTo(x + 0.6, 29.8);
    ctx.lineTo(x + 1.6, 26.6);
    ctx.lineTo(x + 2.6, 29.8);
  }
  ctx.fill();
  // front arm with claws
  limb(ctx, [[44, 27], [52, 41], [50, 53]], 9, [C.venom, C.venom]);
  for (const k of [-1, 0, 1, 2]) limb(ctx, [[50, 53], [52 + k * 1.6, 59 - Math.abs(k) * 0.6]], 1.4, [C.white]);
  // tongue
  taper(ctx, cubic([57, 28], [66, 33 + breathe * 2], [58, 40], [65, 47 + breathe * 2], 12), 5, 1.2, C.tongue, 1.8);
}

function bolt(ctx: Ctx, from: Pt, angle: number, length: number, seed: number) {
  const pts: Pt[] = [from];
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const d = (length * i) / n;
    const off = i === n ? 0 : (Math.sin(seed * 9.1 + i * 3.7) * 0.5 + 0.5 - 0.5) * 9;
    pts.push([from[0] + Math.cos(angle) * d - Math.sin(angle) * off, from[1] + Math.sin(angle) * d + Math.cos(angle) * off]);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';
  trace(ctx, pts, false);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();
  ctx.strokeStyle = C.yellow;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function drawElectro(ctx: Ctx, t: number) {
  const flick = Math.floor(t / 3);
  const glow = ctx.createRadialGradient(36, 22, 2, 36, 22, 34);
  glow.addColorStop(0, 'rgba(255, 236, 80, 0.55)');
  glow.addColorStop(1, 'rgba(255, 236, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, -10, 72, 64);
  // trailing legs
  limb(ctx, [[20, 26], [10, 30], [1, 27]], 5.6, [C.electroDark, C.electroDark]);
  limb(ctx, [[21, 28], [11, 34], [3, 34]], 5.6, [C.electro, C.electro]);
  oval(ctx, 1.5, 27, 2.8, 2.6, C.yellow, 1.8);
  oval(ctx, 3, 34, 2.8, 2.6, C.yellow, 1.8);
  // torso flying horizontally
  poly(ctx, [[17, 24], [22, 19], [40, 17], [44, 22], [40, 29], [20, 31]], C.electro);
  poly(ctx, [[24, 20], [30, 25], [27, 25], [34, 30], [29, 25.5], [32, 25.5]], C.yellow, 1.2);
  // arms forward with yellow gloves
  limb(ctx, [[38, 20], [47, 17], [56, 18]], 4.8, [C.electro, C.electro]);
  limb(ctx, [[38, 25], [47, 27], [55, 25]], 4.8, [C.electroDark, C.electroDark]);
  oval(ctx, 57, 18, 2.8, 2.6, C.yellow, 1.8);
  oval(ctx, 56, 25, 2.8, 2.6, C.yellow, 1.8);
  // star mask behind the head
  starburst(ctx, 46, 12.5, 12.5, 5.5, 7, C.yellow, 2.2, 1.8);
  oval(ctx, 46, 12.5, 5.8, 5.6, C.electro, 2);
  poly(ctx, [[46.5, 10.5], [51.5, 9.5], [50.5, 12]], C.white, 1);
  poly(ctx, [[42, 10.5], [45.4, 10.8], [44.6, 12.4]], C.white, 1);
  // crackling bolts from the hands
  bolt(ctx, [59, 18], -0.25 + Math.sin(flick) * 0.4, 12, flick);
  bolt(ctx, [58, 25], 0.35 + Math.cos(flick * 1.7) * 0.4, 11, flick + 4);
  if (flick % 2 === 0) bolt(ctx, [46, 2], -1.3, 8, flick + 9);
}

function drawGoblin(ctx: Ctx, t: number) {
  const flick = Math.floor(t / 2) % 3;
  // jet flame
  poly(ctx, [[8, 37], [-6 - flick * 3, 40], [-1, 42], [-9 - flick * 2, 45], [8, 43]], C.orange, 1.6);
  poly(ctx, [[8, 38.5], [0 - flick * 2, 40.5], [8, 42]], C.yellow, 0);
  // back leg
  limb(ctx, [[39, 22], [43, 29], [41, 35]], 4.8, [C.goblinDark, C.goblinDark]);
  // glider: bat wings with scalloped edge and yellow eyes
  poly(
    ctx,
    [[4, 38], [14, 33], [27, 35], [38, 31], [49, 35], [62, 33], [72, 38], [66, 42], [59, 40.5], [53, 45], [46, 41.5], [38, 45.5], [30, 41.5], [23, 45], [17, 40.5], [10, 42]],
    C.glider,
    2.2,
  );
  ctx.strokeStyle = C.gliderLight;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(14, 36);
  ctx.quadraticCurveTo(26, 35, 36, 33.5);
  ctx.moveTo(42, 33.5);
  ctx.quadraticCurveTo(52, 35, 62, 36);
  ctx.stroke();
  poly(ctx, [[32, 37], [36.5, 36], [35.5, 38.6]], C.yellow, 1);
  poly(ctx, [[41.5, 36], [46, 37], [42.5, 38.6]], C.yellow, 1);
  // front leg with purple boot
  limb(ctx, [[36, 22], [33, 29], [35, 34]], 5, [C.goblin, C.purple]);
  // tunic + satchel
  poly(ctx, [[33, 23], [36, 10], [45, 11], [44, 24]], C.purple);
  limb(ctx, [[36, 12], [44, 22]], 1.6, ['#8a5a2b']);
  oval(ctx, 44, 22, 3, 2.4, '#8a5a2b', 1.6);
  // back arm raised, cackling
  limb(ctx, [[37, 13], [30, 8], [33, 2]], 4.4, [C.purpleDark, C.goblinDark]);
  // head: pointy ear, grin, floppy hat
  poly(ctx, [[35, 8], [30.5, 4.5], [36.5, 6]], C.goblin, 1.6);
  oval(ctx, 41, 8.5, 6.2, 6, C.goblin, 2.2);
  poly(ctx, [[46.5, 8], [50, 10], [46.5, 11]], C.goblin, 1.6);
  poly(ctx, [[42.5, 6.2], [46.6, 6.6], [45.4, 8.3]], C.yellow, 1);
  poly(ctx, [[42, 11.4], [47.4, 10.8], [46, 13.6], [42.6, 13.4]], C.white, 1.2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(43.4, 11.3);
  ctx.lineTo(43.6, 13.5);
  ctx.moveTo(45, 11.1);
  ctx.lineTo(45, 13.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(35, 5.5);
  ctx.quadraticCurveTo(38, -2, 47, 3.2);
  ctx.quadraticCurveTo(40, 2, 36, 7);
  ctx.closePath();
  inked(ctx, C.purple, 1.8);
  poly(ctx, [[36, 3.6], [26, 2.5], [34, 6.5]], C.purple, 1.8);
  // front arm holding a pumpkin bomb
  limb(ctx, [[42, 13], [48, 17], [52, 14]], 4.4, [C.purple, C.goblin]);
  oval(ctx, 55.5, 12.5, 4.2, 4, C.orange, 1.8);
  limb(ctx, [[55.5, 8.6], [56.5, 7]], 1.3, [C.goblin]);
  poly(ctx, [[53.6, 11.6], [55, 10.6], [54.6, 12.4]], INK, 0);
  poly(ctx, [[56.6, 11.4], [58, 10.6], [57.6, 12.4]], INK, 0);
}

const VILLAIN_DRAW: Record<VillainKind, (ctx: Ctx, t: number) => void> = {
  ock: drawOck,
  lizard: drawLizard,
  venom: drawVenom,
  electro: drawElectro,
  goblin: drawGoblin,
};

/** Draws a villain with its box's top-left at (x, y), facing left. */
export function drawVillain(ctx: Ctx, kind: VillainKind, x: number, y: number, t: number) {
  const d = VILLAINS[kind];
  ctx.save();
  ctx.translate(x + d.w, y);
  ctx.scale(-1, 1);
  VILLAIN_DRAW[kind](ctx, t);
  ctx.restore();
}

/** White web line with an ink edge, from a hand to an anchor. */
export function webLine(ctx: Ctx, from: Pt, to: Pt) {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // small splat where the web sticks
  ctx.save();
  ctx.translate(to[0], to[1]);
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
  }
  ctx.stroke();
  ctx.restore();
}
