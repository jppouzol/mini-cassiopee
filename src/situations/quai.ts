// Quai long side : bord en y = 0 et rangée de bittes fixes, parallèle au bord.
// Les positions de bitte des situations sont relatives au bateau au départ
// (« bitte », en mètres depuis le centre, positive vers l'avant) ; la rangée,
// elle, est fixe dans le repère monde.

import { HALF_BEAM, HALF_LENGTH } from '../sim/geometry.ts';

/** Distance de la rangée de bittes au bord du quai (m). */
export const BOLLARD_SETBACK = 0.6;
/** Espacement des bittes le long du quai (m). */
export const BOLLARD_SPACING = 2;

/** Ce qu'il faut d'une situation pour situer ses bittes. */
export interface Placement {
  bateau: { x: number; distanceQuai: number; bordAuQuai: 'babord' | 'tribord' };
}

/** Sens de l'étrave le long du quai : +1 si elle pointe vers +x (bâbord au quai), -1 sinon. */
export function bowSign(sit: Placement): 1 | -1 {
  return sit.bateau.bordAuQuai === 'babord' ? 1 : -1;
}

/** Position monde (x) d'une bitte donnée relativement au bateau au départ. */
export function bitteVersMonde(sit: Placement, bitte: number): number {
  return sit.bateau.x + bowSign(sit) * bitte;
}

/** Position relative au bateau au départ d'une bitte donnée par sa position monde (x). */
export function bitteDepuisMonde(sit: Placement, xMonde: number): number {
  return arrondi(bowSign(sit) * (xMonde - sit.bateau.x));
}

/** Vrai si la bitte tombe sur la rangée (à 1 cm près). */
export function surLaRangee(sit: Placement, bitte: number): boolean {
  const k = bitteVersMonde(sit, bitte) / BOLLARD_SPACING;
  return Math.abs(k - Math.round(k)) * BOLLARD_SPACING < 0.01;
}

/** Positions monde (x) des bittes de la rangée comprises dans [xMin, xMax]. */
export function bittesEntre(xMin: number, xMax: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(xMin / BOLLARD_SPACING); k * BOLLARD_SPACING <= xMax; k++) out.push(k * BOLLARD_SPACING);
  return out;
}

/**
 * Position monde (x) du centre d'un voisin : même coque, même cap et même
 * écart au quai que le bateau, à l'écart donné de son étrave ou de son tableau.
 */
export function xVoisin(sit: Placement, cote: 'avant' | 'arriere', ecart: number): number {
  const sens = cote === 'avant' ? 1 : -1;
  return sit.bateau.x + bowSign(sit) * sens * (2 * HALF_LENGTH + ecart);
}

/** Ordonnée monde du centre du bateau au départ. */
export function yDepart(sit: Placement): number {
  return -(HALF_BEAM + sit.bateau.distanceQuai);
}

/** Arrondi au centimètre, pour des valeurs lisibles dans les situations. */
function arrondi(v: number): number {
  return Math.round(v * 100) / 100 + 0;
}
