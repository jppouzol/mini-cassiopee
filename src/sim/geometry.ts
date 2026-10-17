import type { Body, Vec } from './types.ts';

/** Demi-coque bâbord (x, y) de l'étrave au tableau arrière, en repère bateau. */
const HALF: Vec[] = [
  [5, 0], [4.5, 0.55], [3.8, 1.0], [2.8, 1.38], [1.5, 1.62], [0, 1.7],
  [-1.5, 1.68], [-3, 1.6], [-4.2, 1.5], [-5, 1.4],
];

/** Contour complet de la coque (bâbord puis tribord). */
export const HULL: readonly Vec[] = HALF.concat(
  HALF.slice().reverse().map(([x, y]): Vec => [x, -y]),
);

/** Demi-largeur maximale de la coque (m). */
export const HALF_BEAM = 1.7;
/** Demi-longueur de la coque, de l'étrave au tableau arrière (m). */
export const HALF_LENGTH = 5;

/** Arêtes de la coque, sens trigonométrique, sans arête de longueur nulle. */
const EDGES: readonly { a: Vec; t: Vec; len: number }[] = HULL.flatMap((a, i) => {
  const b = HULL[(i + 1) % HULL.length];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return len > 1e-9 ? [{ a, t: [dx / len, dy / len] as Vec, len }] : [];
});

/**
 * Pénétration d'un point dans la coque (repère bateau ; la coque est convexe).
 * Renvoie la profondeur sous l'arête la plus proche et sa normale sortante,
 * ou null si le point est dehors.
 */
export function hullPenetration(p: Vec): { depth: number; n: Vec } | null {
  let depth = Infinity;
  let n: Vec = [0, 0];
  for (const e of EDGES) {
    // Distance signée à la droite de l'arête, positive à l'intérieur.
    const d = e.t[0] * (p[1] - e.a[1]) - e.t[1] * (p[0] - e.a[0]);
    if (d < 0) return null;
    if (d < depth) {
      depth = d;
      n = [e.t[1], -e.t[0]];
    }
  }
  return { depth, n };
}

/** Point monde exprimé dans le repère d'un corps. */
export function toLocal(b: Pick<Body, 'x' | 'y' | 'th'>, w: Vec): Vec {
  const c = Math.cos(b.th), s = Math.sin(b.th);
  const dx = w[0] - b.x, dy = w[1] - b.y;
  return [c * dx + s * dy, -s * dx + c * dy];
}

/** Vecteur d'un repère corps tourné dans le repère monde. */
export function rotate(th: number, v: Vec): Vec {
  const c = Math.cos(th), s = Math.sin(th);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1]];
}

/** Points testés pour le contact avec le quai : sommets et milieux d'arêtes. */
export const CONTACT_POINTS: readonly Vec[] = (() => {
  const pts: Vec[] = [];
  for (let i = 0; i < HULL.length; i++) {
    const a = HULL[i];
    const b = HULL[(i + 1) % HULL.length];
    pts.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  return pts;
})();

/** Abscisses des tranches de coque pour la résistance latérale répartie. */
export const SLICES: readonly number[] = Array.from({ length: 10 }, (_, i) => -4.5 + i);

/**
 * Taquets, en repère bateau. Côté +1 = bâbord, -1 = tribord. Deux à l'étrave, deux au
 * maître-bau (au milieu, au plus large) et deux à l'arrière, un sur chaque bord : côté
 * quai (ou catway) et côté large.
 */
export function cleatPosition(name: string, quaySide: 1 | -1): Vec {
  switch (name) {
    case 'etrave': return [4.5, 0.4 * quaySide];
    case 'etrave-large': return [4.5, -0.4 * quaySide];
    case 'arriere': return [-4.75, 1.2 * quaySide];
    case 'arriere-large': return [-4.75, -1.2 * quaySide];
    case 'maitre-bau': return [0, 1.55 * quaySide];
    case 'maitre-bau-large': return [0, -1.55 * quaySide];
    default: throw new Error(`Taquet inconnu : ${name}`);
  }
}

export const CLEAT_NAMES = ['etrave', 'etrave-large', 'arriere', 'arriere-large', 'maitre-bau', 'maitre-bau-large'] as const;

/** Point du bateau exprimé dans le repère monde. */
export function toWorld(b: Pick<Body, 'x' | 'y' | 'th'>, p: Vec): Vec {
  const c = Math.cos(b.th), s = Math.sin(b.th);
  return [b.x + c * p[0] - s * p[1], b.y + s * p[0] + c * p[1]];
}

/** Vitesse monde d'un point du bateau. */
export function pointVelocity(b: Body, p: Vec): Vec {
  const c = Math.cos(b.th), s = Math.sin(b.th);
  const rx = c * p[0] - s * p[1];
  const ry = s * p[0] + c * p[1];
  return [b.vx - b.w * ry, b.vy + b.w * rx];
}
