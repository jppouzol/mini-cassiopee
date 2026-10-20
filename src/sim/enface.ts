// Rangée d'en face, de l'autre côté de l'allée : périodique et sans fin le long du quai.
// On n'en calcule que les éléments proches d'une abscisse donnée : ceux que le bateau
// peut toucher (effets de contact) ou que la vue montre (rendu).

import type { Catway, RangeeEnFace } from './types.ts';

/** Indices des catways dont l'axe tombe dans [xMin, xMax]. */
function indices(r: RangeeEnFace, xMin: number, xMax: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil((xMin - r.x0) / r.pas); r.x0 + k * r.pas <= xMax; k++) out.push(k);
  return out;
}

/** Catways d'en face dont l'axe est dans [xMin, xMax], montant de la panne vers l'allée. */
export function catwaysEnFace(r: RangeeEnFace, xMin: number, xMax: number): Catway[] {
  return indices(r, xMin, xMax).map((k) => ({
    x: r.x0 + k * r.pas, halfWidth: r.demiLargeurCatway, length: r.longueurCatway, y: r.yPanne, dir: 1,
  }));
}

/** Bateaux d'en face dont le centre est dans [xMin, xMax] : un de chaque côté de chaque catway. */
export function bateauxEnFace(r: RangeeEnFace, xMin: number, xMax: number): { x: number; y: number; th: number }[] {
  return indices(r, xMin - r.recul, xMax + r.recul)
    .flatMap((k) => [r.x0 + k * r.pas - r.recul, r.x0 + k * r.pas + r.recul])
    .filter((x) => x >= xMin && x <= xMax)
    .map((x) => ({ x, y: r.yBateaux, th: r.th }));
}
