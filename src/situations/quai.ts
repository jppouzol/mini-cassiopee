// Géométrie du port : quai, catway et rangées de bittes.
//
// Le bateau est amarré le long d'un « support » : le quai le long du quai
// (long side), le catway en perpendiculaire. Les positions de bitte des
// situations sont relatives au bateau au départ (« bitte », en mètres depuis le
// centre, positive vers l'avant, le long du support) ; les rangées, elles, sont
// fixes dans le repère monde.
//
// Repère monde : x le long du quai, y vers le quai, bord du quai en y = 0.
// Le catway a son axe en x = 0 et descend dans l'eau (y < 0) depuis le quai.
// En perpendiculaire, la position le long du support est la distance au bord
// du quai, comptée le long du catway vers le chenal (u = -y).

import type { Vec } from '../sim/types.ts';
import { HALF_BEAM, HALF_LENGTH } from '../sim/geometry.ts';

/** Distance de la rangée de bittes au bord du quai (m). */
export const BOLLARD_SETBACK = 0.6;
/** Espacement des bittes le long du quai et du catway (m). */
export const BOLLARD_SPACING = 2;
/** Longueur du catway : les 2/3 du bateau (m). */
export const LONGUEUR_CATWAY = Math.round(((2 * 2 * HALF_LENGTH) / 3) * 100) / 100;
/** Demi-largeur du catway (m) ; sa rangée de bittes est sur l'axe. */
export const DEMI_LARGEUR_CATWAY = 0.5;
/** Abscisse monde de l'axe du catway. */
export const X_CATWAY = 0;
/** En perpendiculaire, écart minimal entre le bout du bateau et le quai (m). */
export const ECART_QUAI_MIN = 0.5;
/** Étendue des rangées de bittes du quai, bien au-delà de ce que la caméra montre (m). */
const ETENDUE_QUAI = 200;

export type TypeQuai = 'long-side' | 'perpendiculaire';
export type BoutAuQuai = 'etrave' | 'arriere';

/** Ce qu'il faut d'une situation pour situer le bateau et ses bittes. */
export interface Placement {
  quai: { type: TypeQuai };
  bateau: { x: number; distanceQuai: number; bordAuQuai: 'babord' | 'tribord'; boutAuQuai?: BoutAuQuai };
}

/**
 * Bitte d'une aussière : sur la rangée du support (sur absent), ou, en
 * perpendiculaire, sur la rangée du quai (sur = 'quai'). Dans ce dernier cas,
 * `bitte` est la position le long du quai depuis l'axe du bateau, positive vers le catway.
 */
export interface Amarrage {
  bitte: number;
  sur?: 'quai';
}

export function perpendiculaire(sit: Pick<Placement, 'quai'>): boolean {
  return sit.quai.type === 'perpendiculaire';
}

/**
 * Sens de l'étrave le long du support : +1 si elle pointe vers les positions croissantes.
 * Le long du quai, bâbord au quai : étrave vers +x. En perpendiculaire, arrière au quai :
 * étrave vers le chenal.
 */
export function bowSign(sit: Placement): 1 | -1 {
  if (perpendiculaire(sit)) return sit.bateau.boutAuQuai === 'arriere' ? 1 : -1;
  return sit.bateau.bordAuQuai === 'babord' ? 1 : -1;
}

/** Flanc tourné vers le support, en repère bateau : +1 bâbord, -1 tribord. */
export function quaySide(sit: Placement): 1 | -1 {
  return sit.bateau.bordAuQuai === 'babord' ? 1 : -1;
}

/** Position le long du support d'une bitte donnée relativement au bateau au départ. */
export function bitteVersSupport(sit: Placement, bitte: number): number {
  return sit.bateau.x + bowSign(sit) * bitte;
}

/** Position relative au bateau au départ d'une bitte donnée par sa position le long du support. */
export function bitteDepuisSupport(sit: Placement, u: number): number {
  return arrondi(bowSign(sit) * (u - sit.bateau.x));
}

/** Cap du bateau au départ (rad). */
function cap(sit: Placement): number {
  if (perpendiculaire(sit)) return sit.bateau.boutAuQuai === 'etrave' ? Math.PI / 2 : -Math.PI / 2;
  // Bâbord au quai : étrave vers +x. Tribord au quai : étrave vers -x.
  return bowSign(sit) === 1 ? 0 : Math.PI;
}

/**
 * En perpendiculaire, abscisse monde de l'axe du bateau : du côté du catway où son flanc
 * choisi lui fait face. Étrave au quai (cap π/2), bâbord regarde vers -x : le catway est à
 * gauche à l'écran et le bateau à droite.
 */
function xAxe(sit: Placement): number {
  return quaySide(sit) * Math.sin(cap(sit)) * (DEMI_LARGEUR_CATWAY + sit.bateau.distanceQuai + HALF_BEAM);
}

/** En perpendiculaire, sens monde (+1 ou -1 en x) de l'axe du bateau vers le catway. */
function versCatway(sit: Placement): 1 | -1 {
  return xAxe(sit) > X_CATWAY ? -1 : 1;
}

/** Position et cap du bateau au départ, en repère monde. */
export function poseDepart(sit: Placement): { x: number; y: number; th: number } {
  if (perpendiculaire(sit)) return { x: xAxe(sit), y: -sit.bateau.x, th: cap(sit) };
  return { x: sit.bateau.x, y: -(HALF_BEAM + sit.bateau.distanceQuai), th: cap(sit) };
}

/** Position monde d'une bitte. */
export function pointBitte(sit: Placement, a: Amarrage): Vec {
  if (!perpendiculaire(sit)) return [bitteVersSupport(sit, a.bitte), BOLLARD_SETBACK];
  if (a.sur === 'quai') return [arrondi(xAxe(sit) + versCatway(sit) * a.bitte), BOLLARD_SETBACK];
  return [X_CATWAY, -bitteVersSupport(sit, a.bitte)];
}

/** Vrai si v est un multiple de l'espacement des bittes (à 1 cm près). */
function surLePas(v: number): boolean {
  const k = v / BOLLARD_SPACING;
  return Math.abs(k - Math.round(k)) * BOLLARD_SPACING < 0.01;
}

/** Vrai si la bitte tombe sur une rangée : celle du quai, ou celle du catway sans dépasser son bout. */
export function surLaRangee(sit: Placement, a: Amarrage): boolean {
  if (a.sur === 'quai' || !perpendiculaire(sit)) return surLePas(pointBitte(sit, a)[0]);
  const u = bitteVersSupport(sit, a.bitte);
  return surLePas(u) && u > 0.01 && u <= LONGUEUR_CATWAY + 0.01;
}

/** Positions monde (x) des bittes de la rangée du quai comprises dans [xMin, xMax]. */
export function bittesEntre(xMin: number, xMax: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(xMin / BOLLARD_SPACING); k * BOLLARD_SPACING <= xMax; k++) out.push(k * BOLLARD_SPACING);
  return out;
}

/** Positions le long du catway (depuis le bord du quai) de sa rangée de bittes. */
export function bittesDuCatway(): number[] {
  return bittesEntre(0.01, LONGUEUR_CATWAY + 0.01);
}

/** Toutes les bittes à dessiner, en repère monde : rangée du quai, puis celle du catway s'il y en a un. */
export function bittesDuPort(sit: Pick<Placement, 'quai'>): Vec[] {
  const quai = bittesEntre(-ETENDUE_QUAI, ETENDUE_QUAI).map((x): Vec => [x, BOLLARD_SETBACK]);
  if (!perpendiculaire(sit)) return quai;
  return quai.concat(bittesDuCatway().map((u): Vec => [X_CATWAY, -u]));
}

/** Bitte d'une aussière d'après la position monde d'une bitte touchée dans l'éditeur. */
export function bitteDepuisPoint(sit: Placement, p: Vec): Amarrage {
  if (p[1] < 0) return { bitte: bitteDepuisSupport(sit, -p[1]) };
  if (!perpendiculaire(sit)) return { bitte: bitteDepuisSupport(sit, p[0]) };
  return { bitte: arrondi(versCatway(sit) * (p[0] - xAxe(sit))), sur: 'quai' };
}

/**
 * Position d'une bitte dans le repère du bateau au départ, tourné vers le support :
 * [le long du bateau (positif vers l'avant), vers le support]. Elle ne dépend donc
 * pas du bord au quai ; c'est sur elle que se calcule le nom déduit.
 */
export function bitteRepereBateau(sit: Placement, a: Amarrage): Vec {
  if (perpendiculaire(sit) && a.sur === 'quai') {
    // Bitte du quai : en avant de l'étrave (ou en arrière du tableau) de la distance au bord
    // du quai plus le recul de la rangée ; de côté, sa position le long du quai.
    return [-bowSign(sit) * (sit.bateau.x + BOLLARD_SETBACK), a.bitte];
  }
  const recul = perpendiculaire(sit) ? DEMI_LARGEUR_CATWAY : BOLLARD_SETBACK;
  return [a.bitte, recul + HALF_BEAM + sit.bateau.distanceQuai];
}

/**
 * Position monde (x) du centre d'un voisin, le long du quai : même coque, même cap
 * et même écart au quai que le bateau, à l'écart donné de son étrave ou de son tableau.
 */
export function xVoisin(sit: Placement, cote: 'avant' | 'arriere', ecart: number): number {
  const sens = cote === 'avant' ? 1 : -1;
  return sit.bateau.x + bowSign(sit) * sens * (2 * HALF_LENGTH + ecart);
}

/** Arrondi au centimètre, pour des valeurs lisibles dans les situations. */
function arrondi(v: number): number {
  return Math.round(v * 100) / 100 + 0;
}
