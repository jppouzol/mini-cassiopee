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

/** Taquets, en repère bateau. Côté +1 = bâbord, -1 = tribord. */
export function cleatPosition(name: string, quaySide: 1 | -1): Vec {
  switch (name) {
    case 'etrave': return [4.5, 0.15 * quaySide];
    case 'arriere': return [-4.75, 1.2 * quaySide];
    case 'arriere-large': return [-4.75, -1.2 * quaySide];
    case 'maitre-bau': return [0, 1.55 * quaySide];
    default: throw new Error(`Taquet inconnu : ${name}`);
  }
}

export const CLEAT_NAMES = ['etrave', 'arriere', 'arriere-large', 'maitre-bau'] as const;

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
