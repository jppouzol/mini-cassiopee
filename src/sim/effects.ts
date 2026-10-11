import type { Body, Effect, Forces, Vec } from './types.ts';
import { CONTACT_POINTS, SLICES, pointVelocity, toWorld } from './geometry.ts';

// Chaque effet est une fonction pure de l'état et des paramètres, qui ajoute
// une force et un moment. Le socle en active une liste fixe ; les paliers
// suivants ajouteront des effets optionnels (pas d'hélice, bi-safran, fardage…).

/** Ajoute une force exprimée en repère bateau, appliquée au point (px, py) du bateau. */
function addBody(f: Forces, b: Body, fbx: number, fby: number, px: number, py: number): void {
  const c = Math.cos(b.th), s = Math.sin(b.th);
  f.fx += c * fbx - s * fby;
  f.fy += s * fbx + c * fby;
  f.m += px * fby - py * fbx;
}

/** Ajoute une force exprimée en repère monde, appliquée au point p du bateau. */
function addWorld(f: Forces, b: Body, fx: number, fy: number, p: Vec): void {
  const c = Math.cos(b.th), s = Math.sin(b.th);
  const rx = c * p[0] - s * p[1];
  const ry = s * p[0] + c * p[1];
  f.fx += fx;
  f.fy += fy;
  f.m += rx * fy - ry * fx;
}

/** Vitesses en repère bateau : u longitudinale, v latérale. */
function bodyVelocity(b: Body): [number, number] {
  const c = Math.cos(b.th), s = Math.sin(b.th);
  return [c * b.vx + s * b.vy, -s * b.vx + c * b.vy];
}

/** Poussée du moteur, le long de l'axe, à la position de l'hélice. */
export const engine: Effect = (s, p, f) => {
  const t = s.engine > 0 ? p.thrustFwd : s.engine < 0 ? -p.thrustRev : 0;
  addBody(f, s.body, t, 0, p.xProp, 0);
};

/** Safran unique dans le flux d'hélice : efficace en marche avant même sans erre. */
export const rudder: Effect = (s, p, f) => {
  const [u] = bodyVelocity(s.body);
  const wash = s.engine > 0 ? p.rudderWash * p.thrustFwd : 0;
  const flow = p.rudderFlow * u * Math.abs(u);
  addBody(f, s.body, 0, -s.rudder * (wash + flow), p.xRudder, 0);
};

/** Résistance de l'eau : longitudinale, latérale répartie le long de la coque, lacet. */
export const hydrodynamics: Effect = (s, p, f) => {
  const b = s.body;
  const [u, v] = bodyVelocity(b);
  addBody(f, b, -p.dragXq * u * Math.abs(u) - p.dragXl * u, 0, 0, 0);
  const n = SLICES.length;
  for (const xi of SLICES) {
    const vl = v + b.w * xi;
    addBody(f, b, 0, -(p.dragYq * vl * Math.abs(vl) + p.dragYl * vl) / n, xi, 0);
  }
  f.m += -p.yawL * b.w;
};

/** Vent appliqué au centre du bateau (le fardage de l'étrave viendra au palier 2). */
export const wind: Effect = (s, p, f) => {
  const force = s.wind.force === 'faible' ? p.windFaible : s.wind.force === 'soutenu' ? p.windSoutenu : 0;
  if (force === 0) return;
  const b = s.body;
  const c = Math.cos(b.th), sn = Math.sin(b.th);
  const [dx, dy] = s.wind.to;
  const wbx = c * dx + sn * dy;
  const wby = -sn * dx + c * dy;
  addBody(f, b, force * p.windLongRatio * wbx, force * wby, 0, 0);
};

/** Aussières : ressort amorti qui ne travaille qu'en traction. */
export const mooringLines: Effect = (s, p, f) => {
  const b = s.body;
  for (const line of s.lines) {
    line.tension = 0;
    if (!line.attached) continue;
    const pw = toWorld(b, line.cleat);
    const dx = line.bollard[0] - pw[0];
    const dy = line.bollard[1] - pw[1];
    const d = Math.hypot(dx, dy);
    const ext = d - line.len;
    if (ext <= 0 || d === 0) continue;
    const ux = dx / d, uy = dy / d;
    const pv = pointVelocity(b, line.cleat);
    const rate = -(pv[0] * ux + pv[1] * uy);
    const t = Math.max(0, p.lineK * ext + p.lineC * rate);
    line.tension = t;
    addWorld(f, b, t * ux, t * uy, line.cleat);
  }
};

/** Contact avec le bord du quai (y = 0) : réaction normale amortie et frottement. */
export const quayContact: Effect = (s, p, f) => {
  const b = s.body;
  s.contacts = [];
  for (const pt of CONTACT_POINTS) {
    const pw = toWorld(b, pt);
    if (pw[1] <= 0) continue;
    const pv = pointVelocity(b, pt);
    const n = Math.max(0, p.contactK * pw[1] + p.contactC * pv[1]);
    const ft = -Math.sign(pv[0]) * Math.min(p.contactMu * n, p.contactCt * Math.abs(pv[0]));
    addWorld(f, b, ft, -n, pt);
    if (n > 0) s.contacts.push(pw);
  }
};

/** Effets du socle, dans un ordre fixe (gage de déterminisme). */
export const BASE_EFFECTS: readonly Effect[] = [engine, rudder, hydrodynamics, wind, mooringLines, quayContact];
