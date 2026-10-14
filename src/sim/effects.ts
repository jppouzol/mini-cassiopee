import type { Body, Catway, Effect, Forces, Params, Vec } from './types.ts';
import { CONTACT_POINTS, HALF_LENGTH, SLICES, hullPenetration, pointVelocity, rotate, toLocal, toWorld } from './geometry.ts';

// Chaque effet est une fonction pure de l'état et des paramètres, qui ajoute
// une force et un moment. Le socle en active une liste fixe ; les enrichissements
// à venir ajouteront des effets optionnels (pas d'hélice, bi-safran, fardage…).

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

/** Vent appliqué au centre du bateau (le fardage de l'étrave viendra plus tard). */
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

/**
 * Aussières : ressort amorti qui ne travaille qu'en traction.
 * Une aussière choquée file sans retenue : sa longueur suit la distance du
 * taquet à la bitte dès que le bateau s'en éloigne, et ne raccourcit jamais.
 */
export const mooringLines: Effect = (s, p, f) => {
  const b = s.body;
  for (const line of s.lines) {
    line.tension = 0;
    if (!line.attached) continue;
    const pw = toWorld(b, line.cleat);
    const dx = line.bollard[0] - pw[0];
    const dy = line.bollard[1] - pw[1];
    const d = Math.hypot(dx, dy);
    if (line.payingOut && d > line.len) line.len = d;
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

/**
 * Réaction d'appui en un point p du bateau : n est la normale (monde) selon laquelle
 * le bateau est repoussé, depth la profondeur de pénétration. Même loi que le quai :
 * ressort amorti qui ne tire jamais, et frottement le long de la surface.
 * Renvoie l'intensité de la réaction normale.
 */
function push(f: Forces, b: Body, p: Params, pt: Vec, n: Vec, depth: number): number {
  const pv = pointVelocity(b, pt);
  const vn = pv[0] * n[0] + pv[1] * n[1];
  const fn = Math.max(0, p.contactK * depth - p.contactC * vn);
  if (fn === 0) return 0;
  const tx = -n[1], ty = n[0];
  const vt = pv[0] * tx + pv[1] * ty;
  const ft = -Math.sign(vt) * Math.min(p.contactMu * fn, p.contactCt * Math.abs(vt));
  addWorld(f, b, fn * n[0] + ft * tx, fn * n[1] + ft * ty, pt);
  return fn;
}

/**
 * Contact avec les bateaux voisins, immobiles : coque contre coque, traité
 * comme le quai. On repousse les points de la coque entrés dans un voisin, et
 * la coque là où un point du voisin y est entré (un angle de tableau contre le
 * flanc, par exemple). Sans voisin, cet effet n'ajoute rien.
 */
export const neighborContact: Effect = (s, p, f) => {
  const b = s.body;
  for (const nb of s.neighbors) {
    nb.contacts = [];
    // Deux coques de 10 m ne se touchent pas si leurs centres sont à plus de 2 × 5,3 m.
    if (Math.hypot(nb.x - b.x, nb.y - b.y) > 2 * HALF_LENGTH + 0.7) continue;
    for (const pt of CONTACT_POINTS) {
      const w = toWorld(b, pt);
      const pen = hullPenetration(toLocal(nb, w));
      if (pen && push(f, b, p, pt, rotate(nb.th, pen.n), pen.depth) > 0) nb.contacts.push(w);
    }
    for (const q of CONTACT_POINTS) {
      const w = toWorld(nb, q);
      const local = toLocal(b, w);
      const pen = hullPenetration(local);
      if (!pen) continue;
      const out = rotate(b.th, pen.n);
      if (push(f, b, p, local, [-out[0], -out[1]], pen.depth) > 0) nb.contacts.push(w);
    }
  }
};

/**
 * Pénétration d'un point monde dans le catway : profondeur sous le flanc ou le
 * bout le plus proche, et normale (monde) selon laquelle repousser le point.
 * Le côté du quai n'est pas une sortie : le quai a son propre contact.
 */
function catwayPenetration(c: Catway, w: Vec): { depth: number; n: Vec } | null {
  const x0 = c.x - c.halfWidth, x1 = c.x + c.halfWidth;
  if (w[0] <= x0 || w[0] >= x1 || w[1] <= -c.length || w[1] >= 0) return null;
  const faces: { depth: number; n: Vec }[] = [
    { depth: w[0] - x0, n: [-1, 0] },
    { depth: x1 - w[0], n: [1, 0] },
    { depth: w[1] + c.length, n: [0, -1] },
  ];
  return faces.reduce((a, b) => (b.depth < a.depth ? b : a));
}

/**
 * Contact avec le catway, immobile : traité comme le quai. On repousse les
 * points de la coque entrés dans le catway, et la coque là où un angle du bout
 * du catway y est entré. Les points d'appui rejoignent ceux du quai. Sans
 * catway, cet effet n'ajoute rien.
 */
export const catwayContact: Effect = (s, p, f) => {
  const c = s.catway;
  if (!c) return;
  const b = s.body;
  // La coque ne peut toucher le catway que si son centre en est à moins d'une demi-longueur.
  if (b.y < -c.length - HALF_LENGTH || Math.abs(b.x - c.x) > c.halfWidth + HALF_LENGTH) return;
  for (const pt of CONTACT_POINTS) {
    const w = toWorld(b, pt);
    const pen = catwayPenetration(c, w);
    if (pen && push(f, b, p, pt, pen.n, pen.depth) > 0) s.contacts.push(w);
  }
  for (const corner of [[c.x - c.halfWidth, -c.length], [c.x + c.halfWidth, -c.length]] as Vec[]) {
    const local = toLocal(b, corner);
    const pen = hullPenetration(local);
    if (!pen) continue;
    const out = rotate(b.th, pen.n);
    if (push(f, b, p, local, [-out[0], -out[1]], pen.depth) > 0) s.contacts.push(corner);
  }
};

/** Effets du socle, dans un ordre fixe (gage de déterminisme). */
export const BASE_EFFECTS: readonly Effect[] = [
  engine, rudder, hydrodynamics, wind, mooringLines, quayContact, catwayContact, neighborContact,
];
