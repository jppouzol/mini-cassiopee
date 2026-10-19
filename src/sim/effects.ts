import type { Body, Catway, Effect, Forces, Params, SimState, Vec } from './types.ts';
import { thrustOf } from './kick.ts';
import { DT } from './params.ts';
import { CONTACT_POINTS, HALF_LENGTH, SLICES, hullPenetration, pointVelocity, rotate, toLocal, toWorld } from './geometry.ts';

// Chaque effet est une fonction pure de l'état et des paramètres, qui ajoute
// une force et un moment. Le socle en active une liste fixe ; les effets
// optionnels (pas d'hélice, puis bi-safran, fardage…) s'y ajoutent selon les
// options de l'état (`activeEffects`).

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

/** Poussée du moteur, le long de l'axe, à la position de l'hélice ; multipliée pendant un coup de fouet. */
export const engine: Effect = (s, p, f) => {
  const { dir, factor } = thrustOf(s, p);
  const t = dir > 0 ? p.thrustFwd : dir < 0 ? -p.thrustRev : 0;
  addBody(f, s.body, t * factor, 0, p.xProp, 0);
};

/**
 * Vitesse du flux d'hélice au safran (m/s) : en marche avant seulement, l'hélice
 * soufflant sur le safran. Déduite de son effet (`rudderWash`) et de l'efficacité
 * du safran (`rudderFlow`) ; elle croît avec la poussée (`factor`, pendant un coup
 * de fouet). Un bi-safran (#11), hors du flux, la mettra à zéro.
 */
export function washSpeed(dir: number, p: Params, factor = 1): number {
  return dir > 0 ? Math.sqrt((p.rudderWash * p.thrustFwd * factor) / p.rudderFlow) : 0;
}

/**
 * Safran unique dans le flux d'hélice, traité comme un aileron. Deux causes
 * d'incidence s'additionnent :
 * - la barre, avec le flux d'hélice (efficace en marche avant même sans erre) et
 *   l'erre (signée : en marche arrière, la barre agit dans l'autre sens) ;
 * - l'eau qui arrive de côté quand l'arrière dérape : le safran s'y oppose, d'autant
 *   plus que l'eau passe vite, ce qui freine le dérapage et resserre la giration.
 */
export const rudder: Effect = (s, p, f) => {
  const b = s.body;
  const [u, v] = bodyVelocity(b);
  const { dir, factor } = thrustOf(s, p);
  const uw = washSpeed(dir, p, factor);
  const deflection = p.rudderFlow * (uw * uw + u * Math.abs(u)) * s.rudder;
  const vr = v + b.w * p.xRudder;
  const grip = p.rudderFlow * p.rudderGrip * Math.hypot(u, uw) * vr;
  addBody(f, b, 0, -(deflection + grip), p.xRudder, 0);
};

/**
 * Part de la résistance latérale portée par chaque tranche de coque, de somme 1.
 * Avec `center` = 0, elle est uniforme ; en l'augmentant (jusqu'à 1), elle se
 * concentre vers le milieu, où la quille et le tirant d'eau la portent, et
 * s'amenuise aux extrémités. Le total ne change pas : la dérive au vent non plus.
 */
const weightCache = new Map<number, number[]>();
export function sliceWeights(center: number): number[] {
  let w = weightCache.get(center);
  if (!w) {
    const raw = SLICES.map((x) => 1 - center + center * (1 - (x / HALF_LENGTH) ** 2));
    const sum = raw.reduce((a, b) => a + b, 0);
    w = raw.map((r) => r / sum);
    weightCache.set(center, w);
  }
  return w;
}

/**
 * Résistance de l'eau : longitudinale, latérale répartie le long de la coque, lacet,
 * et portance de la quille. La quille, en avançant ou en reculant, s'oppose au
 * dérapage en proportion de la vitesse : c'est elle qui tient le bateau en
 * giration et place le point de pivot. Bateau arrêté, seule reste la résistance latérale répartie.
 */
export const hydrodynamics: Effect = (s, p, f) => {
  const b = s.body;
  const [u, v] = bodyVelocity(b);
  addBody(f, b, -p.dragXq * u * Math.abs(u) - p.dragXl * u, 0, 0, 0);
  const weights = sliceWeights(p.dragYCenter);
  SLICES.forEach((xi, i) => {
    const vl = v + b.w * xi;
    addBody(f, b, 0, -(p.dragYq * vl * Math.abs(vl) + p.dragYl * vl) * weights[i], xi, 0);
  });
  // Comme sur un aileron, le centre de poussée se porte vers l'extrémité qui ouvre
  // la route : vers l'avant en marche avant, vers l'arrière en marche arrière.
  const xk = p.xKeel + Math.sign(u) * p.keelShift;
  addBody(f, b, 0, -p.keelLift * Math.abs(u) * (v + b.w * xk), xk, 0);
  f.m += -p.yawL * b.w;
};

/** Force du vent par le travers (N), selon son réglage. */
function windForce(s: SimState, p: Params): number {
  return s.wind.force === 'faible' ? p.windFaible : s.wind.force === 'soutenu' ? p.windSoutenu : 0;
}

/** Direction vers laquelle souffle le vent, en repère bateau. */
function windInBody(s: SimState): Vec {
  const c = Math.cos(s.body.th), sn = Math.sin(s.body.th);
  const [dx, dy] = s.wind.to;
  return [c * dx + sn * dy, -sn * dx + c * dy];
}

/** Vent appliqué au centre du bateau ; le fardage (effet optionnel) y ajoute un moment. */
export const wind: Effect = (s, p, f) => {
  const force = windForce(s, p);
  if (force === 0) return;
  const [wbx, wby] = windInBody(s);
  addBody(f, s.body, force * p.windLongRatio * wbx, force * wby, 0, 0);
};

/**
 * Aussières : ressort amorti qui ne travaille qu'en traction.
 * Une aussière choquée file sans retenue : sa longueur suit la distance du
 * taquet à la bitte dès que le bateau s'en éloigne, et ne raccourcit jamais.
 * Une aussière reprise raccourcit à vitesse constante (`haulSpeed`) tant que la
 * tension du sous-pas précédent reste sous l'effort de l'équipier (`crewEffort`),
 * sans descendre sous `lineMinLen` : elle rattrape le mou, puis reste raide. Si la
 * tension ressentie (`load`, lissée sur `crewHold`) dépasse cet effort de plus de la
 * marge (`crewMargin`), l'équipier ne tient plus : il lâche, et l'aussière passe
 * d'elle-même sur `choque`. Le lissage lui fait encaisser l'à-coup du mou qui se
 * rattrape, mais pas un effort qui dure.
 */
export const mooringLines: Effect = (s, p, f) => {
  const b = s.body;
  for (const line of s.lines) {
    const prev = line.tension;
    line.tension = 0;
    if (!line.attached) { line.load = 0; continue; }
    const pw = toWorld(b, line.cleat);
    const dx = line.bollard[0] - pw[0];
    const dy = line.bollard[1] - pw[1];
    const d = Math.hypot(dx, dy);
    if (line.mode === 'choque' && d > line.len) line.len = d;
    else if (line.mode === 'reprend' && prev < p.crewEffort && line.len > p.lineMinLen) {
      line.len = Math.max(p.lineMinLen, line.len - p.haulSpeed * DT);
    }
    const ext = d - line.len;
    if (ext > 0 && d > 0) {
      const ux = dx / d, uy = dy / d;
      const pv = pointVelocity(b, line.cleat);
      const rate = -(pv[0] * ux + pv[1] * uy);
      line.tension = Math.max(0, p.lineK * ext + p.lineC * rate);
      addWorld(f, b, line.tension * ux, line.tension * uy, line.cleat);
    }
    line.load += (line.tension - line.load) * Math.min(1, DT / p.crewHold);
    if (line.mode === 'reprend' && line.load > p.crewEffort * (1 + p.crewMargin)) line.mode = 'choque';
  }
};

/**
 * Contact avec le bord du quai (y = 0) : réaction normale amortie et frottement.
 * Sans quai (situation libre), aucun appui. L'effet vide toujours la liste des appuis,
 * que le catway complète ensuite.
 */
export const quayContact: Effect = (s, p, f) => {
  const b = s.body;
  s.contacts = [];
  if (!s.quay) return;
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
 * Contact avec les catways, immobiles : traités comme le quai. On repousse les
 * points de la coque entrés dans un catway, et la coque là où un angle du bout
 * d'un catway y est entré. Les points d'appui rejoignent ceux du quai. Sans
 * catway, cet effet n'ajoute rien.
 */
export const catwayContact: Effect = (s, p, f) => {
  const b = s.body;
  for (const c of s.catways) {
    // La coque ne peut toucher le catway que si son centre en est à moins d'une demi-longueur.
    if (b.y < -c.length - HALF_LENGTH || Math.abs(b.x - c.x) > c.halfWidth + HALF_LENGTH) continue;
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
  }
};

/**
 * Pas d'hélice (effet optionnel) : poussée latérale à l'hélice, quand le moteur
 * tourne. Hélice à droite, l'arrière part vers bâbord en marche arrière ; en
 * marche avant, l'effet est plus faible et de sens contraire. Hélice à gauche,
 * tout s'inverse. Il est le plus fort bateau arrêté et faiblit quand l'erre
 * augmente (de moitié à `propWalkSpeed`), l'eau qui passe régularisant le flux
 * de l'hélice : avec de l'erre, la barre reprend le dessus.
 */
export const propWalk: Effect = (s, p, f) => {
  const { dir, factor } = thrustOf(s, p);
  if (dir === 0 || !s.options.propWalk) return;
  const [u] = bodyVelocity(s.body);
  const hand = s.options.propWalk === 'droite' ? 1 : -1;
  const side = dir < 0 ? hand * p.propWalkRev : -hand * p.propWalkFwd;
  const r = u / p.propWalkSpeed;
  addBody(f, s.body, 0, (side * factor) / (1 + r * r), p.xProp, 0);
};

/**
 * Fardage (effet optionnel) : la prise au vent de la coque et du gréement ne s'applique
 * pas au centre. Son point d'application se porte vers le bout d'où vient le vent :
 * en avant vent de face, un peu en avant par le travers, en arrière vent arrière
 * (`windageX` + `windageShift` × cosinus de l'angle d'où vient le vent, compté depuis
 * l'étrave). L'effet ajoute seulement le moment de la force latérale du vent, déjà
 * appliquée au centre par le socle.
 *
 * Vent de face, l'équilibre devient instable : un petit écart de cap grandit et l'avant
 * abat ; arrêté, le bateau finit à peu près en travers. Vent pile dans l'axe, rien ne
 * brise la symétrie : l'effet ajoute le moment d'un vent qui arriverait légèrement de
 * côté (`windageSkew`), du côté tiré au départ (`options.windage`), si bien que l'avant
 * abat de ce côté quand ni la barre ni le pas d'hélice n'en décident. Ce déclencheur
 * s'efface quand le vent vient de travers.
 */
export const windage: Effect = (s, p, f) => {
  const force = windForce(s, p);
  if (force === 0 || !s.options.windage) return;
  const [wbx, wby] = windInBody(s);
  const x = p.windageX - p.windageShift * wbx;
  // Déclencheur : comme si le vent arrivait de windageSkew sur le côté tiré, mais seulement
  // vent dans l'axe (wbx²), pour que le côté tiré ne change rien vent de travers. Côté 1 :
  // l'avant part vers bâbord, que le vent vienne de l'avant ou de l'arrière.
  const nudge = s.options.windage * p.windageSkew * Math.abs(x) * wbx * wbx;
  f.m += force * (x * wby + nudge);
};

/** Effets du socle, dans un ordre fixe (gage de déterminisme). */
export const BASE_EFFECTS: readonly Effect[] = [
  engine, rudder, hydrodynamics, wind, mooringLines, quayContact, catwayContact, neighborContact,
];

/** Effets optionnels, dans l'ordre où ils s'ajoutent au socle. */
const OPTIONAL_EFFECTS: readonly { effect: Effect; on: (s: SimState) => boolean }[] = [
  { effect: propWalk, on: (s) => !!s.options.propWalk },
  { effect: windage, on: (s) => !!s.options.windage },
];

const listCache = new Map<string, readonly Effect[]>();

/**
 * Effets actifs d'après les options de l'état : le socle, puis les effets
 * optionnels activés, toujours dans le même ordre.
 */
export function activeEffects(s: SimState): readonly Effect[] {
  const on = OPTIONAL_EFFECTS.map((o) => o.on(s));
  if (!on.includes(true)) return BASE_EFFECTS;
  const key = on.map(Number).join('');
  let list = listCache.get(key);
  if (!list) {
    list = [...BASE_EFFECTS, ...OPTIONAL_EFFECTS.filter((_, i) => on[i]).map((o) => o.effect)];
    listCache.set(key, list);
  }
  return list;
}
