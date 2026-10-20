// Géométrie du port : quai, catway et rangées de bittes.
//
// Le bateau est amarré le long d'un « support » : le quai le long du quai
// (long side), le catway en perpendiculaire. Les positions de bitte des
// situations sont relatives au bateau au départ (« bitte », en mètres depuis le
// centre, positive vers l'avant, le long du support) ; les rangées, elles, sont
// fixes dans le repère monde.
//
// Repère monde : x le long du quai, y vers le quai, bord du quai en y = 0.
// En perpendiculaire, le catway du bateau a son axe en x = 0 et descend dans
// l'eau (y < 0) depuis le quai ; un second catway, côté large, encadre avec
// lui deux places de bateau. La position le long du support est la distance au
// bord du quai, comptée le long du catway vers le chenal (u = -y).
// En situation libre, il n'y a ni quai ni bitte : le bateau part de l'origine,
// étrave vers +y (le haut de l'écran).

import type { Vec } from '../sim/types.ts';
import { HALF_BEAM, HALF_LENGTH } from '../sim/geometry.ts';

/** Distance de la rangée de bittes au bord du quai (m). */
export const BOLLARD_SETBACK = 0.6;
/** Espacement des bittes le long du quai (m). */
export const BOLLARD_SPACING = 2;
/** Longueur du catway : les 2/3 du bateau (m). */
export const LONGUEUR_CATWAY = Math.round(((2 * 2 * HALF_LENGTH) / 3) * 100) / 100;
/** Demi-largeur du catway (m) ; ses bittes sont sur l'axe. */
export const DEMI_LARGEUR_CATWAY = 0.5;
/** Abscisse monde de l'axe du catway du bateau. */
export const X_CATWAY = 0;
/** Écart entre les bords de deux catways voisins : deux places de bateau côte à côte (m). */
export const ECART_CATWAYS = 8;
/** Bittes d'un catway, depuis le bord du quai : au milieu et près du bout (m). */
export const BITTES_CATWAY: readonly number[] = [
  Math.round((LONGUEUR_CATWAY / 2) * 10) / 10,
  Math.round((LONGUEUR_CATWAY - 0.3) * 10) / 10,
];
/** En perpendiculaire, écart minimal entre le bout du bateau et le quai (m). */
export const ECART_QUAI_MIN = 0.5;
/**
 * Bateaux en face, de l'autre côté de l'allée : largeur d'allée proposée par l'éditeur (m),
 * en eau libre, du bout du bateau côté chenal dans la situation d'origine aux arrières des
 * bateaux d'en face. Étroite : une fois et demie la longueur du bateau, le demi-tour se fait
 * en plusieurs fois. Large : barre à fond, le demi-tour passe juste.
 */
export const ALLEES = { etroite: 15, large: 20 } as const;
export type Allee = keyof typeof ALLEES;
/** Bornes de l'allée acceptées dans une situation, depuis le bout du bateau côté chenal (m). */
export const ALLEE_MIN = 5;
export const ALLEE_MAX = 40;
/** Largeur de la panne d'en face (m). */
export const LARGEUR_PANNE = 2;
/** Écart entre l'étrave d'un bateau d'en face et sa panne (m). */
export const ECART_PANNE = 1;
/** Écart entre un bateau d'en face et son catway (m), celui des places du catalogue. */
export const ECART_CATWAY_EN_FACE = 0.3;
/** Longueur dont la panne d'en face dépasse ses coques extrêmes (m). */
const DEBORD_PANNE = 1;

/** Étendue des rangées de bittes du quai, bien au-delà de ce que la caméra montre (m). */
const ETENDUE_QUAI = 200;

export type TypeQuai = 'long-side' | 'perpendiculaire' | 'libre';
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

/** Situation libre : le bateau seul, en milieu de port, sans quai ni amarre. */
export function libre(sit: Pick<Placement, 'quai'>): boolean {
  return sit.quai.type === 'libre';
}

/**
 * Bateau d'une situation libre : valeurs neutres, jamais écrites dans un fichier, pour que
 * les fonctions qui attendent un bateau le long d'un support restent valables. Seule
 * poseDepart en tient compte, pour placer le bateau à l'origine.
 */
export const BATEAU_LIBRE: Placement['bateau'] = { x: 0, distanceQuai: 0, bordAuQuai: 'babord' };

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
  // Libre : étrave vers le haut de l'écran.
  if (libre(sit)) return Math.PI / 2;
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

/**
 * Abscisses monde des axes des catways : celui du bateau, puis le second, côté large,
 * qui encadre avec lui deux places côte à côte. Liste vide le long du quai.
 */
export function axesCatways(sit: Placement): number[] {
  if (!perpendiculaire(sit)) return [];
  return [X_CATWAY, X_CATWAY - versCatway(sit) * (ECART_CATWAYS + 2 * DEMI_LARGEUR_CATWAY)];
}

/** Position et cap du bateau au départ, en repère monde. */
export function poseDepart(sit: Placement): { x: number; y: number; th: number } {
  if (libre(sit)) return { x: 0, y: 0, th: cap(sit) };
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

/** Vrai si la bitte en est une : sur la rangée du quai, ou l'une des bittes du catway du bateau. */
export function surLaRangee(sit: Placement, a: Amarrage): boolean {
  if (!perpendiculaire(sit)) return surLePas(pointBitte(sit, a)[0]);
  if (a.sur === 'quai') {
    const x = pointBitte(sit, a)[0];
    return bittesQuai(sit).some((b) => Math.abs(b - x) < 0.01);
  }
  const u = bitteVersSupport(sit, a.bitte);
  return BITTES_CATWAY.some((b) => Math.abs(b - u) < 0.01);
}

/** Positions monde (x) des bittes de la rangée du quai comprises dans [xMin, xMax]. */
export function bittesEntre(xMin: number, xMax: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(xMin / BOLLARD_SPACING); k * BOLLARD_SPACING <= xMax; k++) out.push(k * BOLLARD_SPACING);
  return out;
}

/**
 * Abscisses monde des bittes du quai, de gauche à droite. Le long du quai : tous les 2 m.
 * En perpendiculaire : une bitte dans l'alignement de chaque bord de catway, puis tous
 * les 2 m entre les catways et au-delà.
 */
export function bittesQuai(sit: Placement): number[] {
  if (libre(sit)) return [];
  if (!perpendiculaire(sit)) return bittesEntre(-ETENDUE_QUAI, ETENDUE_QUAI);
  const bords = axesCatways(sit).sort((a, b) => a - b)
    .flatMap((a) => [a - DEMI_LARGEUR_CATWAY, a + DEMI_LARGEUR_CATWAY]);
  const out: number[] = [];
  for (let x = bords[0]; x >= -ETENDUE_QUAI; x -= BOLLARD_SPACING) out.unshift(x);
  for (let i = 1; i + 1 < bords.length; i += 2) {
    for (let x = bords[i]; x < bords[i + 1] - 0.01; x += BOLLARD_SPACING) out.push(x);
    out.push(bords[i + 1]);
  }
  for (let x = bords[bords.length - 1]; x <= ETENDUE_QUAI; x += BOLLARD_SPACING) out.push(x);
  return out.map(arrondi);
}

/** Bittes où l'on peut tourner une aussière, en repère monde : celles du quai, puis celles du catway du bateau ; aucune en libre. */
export function bittesDuPort(sit: Placement): Vec[] {
  if (libre(sit)) return [];
  const quai = bittesQuai(sit).map((x): Vec => [x, BOLLARD_SETBACK]);
  if (!perpendiculaire(sit)) return quai;
  return quai.concat(BITTES_CATWAY.map((u): Vec => [X_CATWAY, -u]));
}

/**
 * Bittes des autres catways, qui servent aux places voisines : le second catway, puis les
 * catways d'en face s'il y en a. Dessinées, jamais proposées.
 */
export function bittesAutresCatways(sit: Placement & { enFace?: number }): Vec[] {
  const second = axesCatways(sit).slice(1).flatMap((x) => BITTES_CATWAY.map((u): Vec => [x, -u]));
  const face = geometrieEnFace(sit);
  if (!face) return second;
  return second.concat(face.catways.flatMap((c) => BITTES_CATWAY.map((u): Vec => [c.x, c.y + u])));
}

/**
 * Distance du bord du quai aux arrières des bateaux d'en face, pour une allée de la largeur
 * donnée comptée depuis le bout du bateau côté chenal dans la situation d'origine (m).
 */
export function distanceEnFace(origine: Pick<Placement, 'bateau'>, largeur: number): number {
  return arrondi(origine.bateau.x + HALF_LENGTH + largeur);
}

/** Rangée d'en face : panne, catways tournés vers l'allée et bateaux, étrave à la panne. */
export interface EnFace {
  panne: { x0: number; x1: number; y0: number; y1: number };
  catways: { x: number; halfWidth: number; length: number; y: number; dir: 1 }[];
  bateaux: { x: number; y: number; th: number }[];
}

/**
 * Géométrie de la rangée d'en face, de l'autre côté de l'allée, ou null s'il n'y en a pas
 * (champ `enFace` absent, ou hors du catway). Les arrières des bateaux sont à `enFace` du
 * bord du quai ; leurs étraves, à ECART_PANNE de la panne. Deux catways, dans l'alignement
 * de ceux du bateau (ils le suivent quand il change de bord), montent de la panne vers
 * l'allée ; un bateau de chaque côté de chacun, à ECART_CATWAY_EN_FACE : quatre places, en
 * face de celles du bateau et de ses voisins. La panne dépasse de DEBORD_PANNE les coques extrêmes.
 */
export function geometrieEnFace(sit: Placement & { enFace?: number }): EnFace | null {
  if (!perpendiculaire(sit) || sit.enFace === undefined) return null;
  const yArrieres = -sit.enFace;
  const yPanne = yArrieres - 2 * HALF_LENGTH - ECART_PANNE;
  const axes = axesCatways(sit).slice().sort((a, b) => a - b);
  const recul = DEMI_LARGEUR_CATWAY + ECART_CATWAY_EN_FACE + HALF_BEAM;
  const bateaux = axes.flatMap((a) => [-1, 1].map((cote) => ({
    x: arrondi(a + cote * recul), y: arrondi(yArrieres - HALF_LENGTH), th: -Math.PI / 2,
  })));
  const catways = axes.map((x) => ({ x, halfWidth: DEMI_LARGEUR_CATWAY, length: LONGUEUR_CATWAY, y: yPanne, dir: 1 as const }));
  const bord = recul + HALF_BEAM + DEBORD_PANNE;
  return {
    panne: { x0: arrondi(axes[0] - bord), x1: arrondi(axes[axes.length - 1] + bord), y0: arrondi(yPanne - LARGEUR_PANNE), y1: yPanne },
    catways,
    bateaux,
  };
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

/**
 * En perpendiculaire, écart entre la coque du bateau et celle d'un voisin côté large,
 * amarré contre le second catway au même écart que le bateau contre le sien (m).
 * Les deux places se partagent l'intervalle entre les catways.
 */
export function ecartVoisinLarge(sit: Placement): number {
  return arrondi(ECART_CATWAYS - 2 * (sit.bateau.distanceQuai + 2 * HALF_BEAM));
}

/**
 * Position et cap d'un voisin. Le long du quai (avant, arriere) : même coque, même cap
 * et même écart au quai que le bateau, à l'écart donné de son étrave ou de son tableau.
 * En perpendiculaire (catway, large) : étrave au quai, à la distance donnée du bord du
 * quai, et au même écart de son catway que le bateau du sien ; côté catway, de l'autre
 * flanc du catway du bateau ; côté large, contre le second catway.
 */
export function poseVoisin(sit: Placement, cote: 'avant' | 'arriere' | 'catway' | 'large', valeur: number): { x: number; y: number; th: number } {
  if (cote === 'avant' || cote === 'arriere') return { x: xVoisin(sit, cote, valeur), y: poseDepart(sit).y, th: cap(sit) };
  const recul = DEMI_LARGEUR_CATWAY + sit.bateau.distanceQuai + HALF_BEAM;
  const x = cote === 'catway'
    ? X_CATWAY - (xAxe(sit) - X_CATWAY)
    : axesCatways(sit)[1] + versCatway(sit) * recul;
  return { x: arrondi(x), y: -(valeur + HALF_LENGTH), th: Math.PI / 2 };
}

/** Arrondi au centimètre, pour des valeurs lisibles dans les situations. */
function arrondi(v: number): number {
  return Math.round(v * 100) / 100 + 0;
}
