// Édition des aussières d'une situation, pendant la préparation.
// Fonctions pures : chacune renvoie une nouvelle situation, ou lève une
// EditionError au message lisible. Aucune dépendance au navigateur.

import { HALF_BEAM, cleatPosition } from '../sim/geometry.ts';
import { BOLLARD_SETBACK, bitteDepuisMonde, bitteVersMonde, bowSign, surLaRangee } from './quai.ts';
import {
  ECART_VOISIN_MIN, PLAFOND_DEFAUT, PLAFOND_MAX, plafond,
  type Cleat, type CoteVoisin, type Situation, type SituationLine,
} from './schema.ts';

/** Taquets proposés dans l'éditeur (le maître-bau viendra plus tard). */
export const TAQUETS_EDITABLES: readonly Cleat[] = ['etrave', 'arriere'];

/** Taquets proposés, avec leur position en repère bateau selon le bord au quai. */
export function taquetsProposes(sit: Pick<Situation, 'bateau'>): { name: Cleat; pos: [number, number] }[] {
  const quaySide = sit.bateau.bordAuQuai === 'babord' ? 1 : -1;
  return TAQUETS_EDITABLES.map((name) => ({ name, pos: cleatPosition(name, quaySide) }));
}

/** Mou donné à une aussière basculée en « molle » (m). */
export const MOU_MOLLE = 0.5;

/** En deçà de cet angle avec la perpendiculaire au bateau, une aussière est un traversier. */
export const SEUIL_TRAVERSIER_DEG = 20;

export class EditionError extends Error {}

/**
 * Nom déduit de la géométrie au départ, sans numéro.
 * Le calcul se fait en repère bateau (le long du bateau et vers le quai) :
 * il ne dépend donc pas du bord au quai.
 */
export function nomDeduit(sit: Pick<Situation, 'bateau'>, a: Pick<SituationLine, 'taquet' | 'bitte'>): string {
  const [xc, yc] = cleatPosition(a.taquet, 1);
  // Écart le long du bateau (positif vers l'avant) et écart vers le quai, du taquet à la bitte.
  const along = a.bitte - xc;
  const across = BOLLARD_SETBACK + HALF_BEAM + sit.bateau.distanceQuai - yc;
  const angle = (Math.atan2(Math.abs(along), Math.abs(across)) * 180) / Math.PI;
  const avant = xc > 0;
  const bout = a.taquet === 'maitre-bau' ? 'au maître-bau' : avant ? 'avant' : 'arrière';
  if (angle < SEUIL_TRAVERSIER_DEG) return `Traversier ${bout}`;
  if (a.taquet === 'maitre-bau') return 'Garde au maître-bau';
  // Pointe : vers l'extérieur du bateau ; garde : vers l'intérieur.
  const pointe = avant ? along > 0 : along < 0;
  return `${pointe ? 'Pointe' : 'Garde'} ${bout}`;
}

/**
 * Noms affichés de toutes les aussières, dans l'ordre de la situation.
 * Un nom choisi est gardé tel quel ; les noms déduits identiques sont numérotés.
 */
export function nomsAffiches(sit: Pick<Situation, 'bateau' | 'aussieres'>): string[] {
  const deduits = sit.aussieres.map((a) => (a.nom ? null : nomDeduit(sit, a)));
  const total = new Map<string, number>();
  for (const n of deduits) if (n) total.set(n, (total.get(n) ?? 0) + 1);
  const vus = new Map<string, number>();
  return sit.aussieres.map((a, i) => {
    const n = deduits[i];
    if (!n) return a.nom as string;
    if ((total.get(n) ?? 0) < 2) return n;
    const k = (vus.get(n) ?? 0) + 1;
    vus.set(n, k);
    return `${n} ${k}`;
  });
}

/** Ajoute une aussière tendue entre un taquet et une bitte (position relative au bateau). */
export function ajouterAussiere(sit: Situation, taquet: Cleat, bitte: number): Situation {
  if (!surLaRangee(sit, bitte)) throw new EditionError('Cette position ne correspond à aucune bitte du quai.');
  if (sit.aussieres.some((a) => a.taquet === taquet && a.bitte === bitte)) {
    throw new EditionError('Une aussière relie déjà ce taquet à cette bitte.');
  }
  const max = plafond(sit);
  if (sit.aussieres.length >= max) {
    throw new EditionError(`Plafond atteint : ${max} aussières au maximum. Il se règle dans les options avancées.`);
  }
  let n = sit.aussieres.length + 1;
  while (sit.aussieres.some((a) => a.id === `aussiere-${n}`)) n++;
  return { ...sit, aussieres: [...sit.aussieres, { id: `aussiere-${n}`, taquet, bitte, mou: 0 }] };
}

export function supprimerAussiere(sit: Situation, id: string): Situation {
  return { ...sit, aussieres: sit.aussieres.filter((a) => a.id !== id) };
}

/** Bascule une aussière entre tendue (pas de mou) et molle (MOU_MOLLE). */
export function basculerMou(sit: Situation, id: string): Situation {
  return modifier(sit, id, (a) => ({ ...a, mou: a.mou > 0 ? 0 : MOU_MOLLE }));
}

/** Bascule une aussière entre bloquée et choquée au départ (elle file dès la mise en mouvement). */
export function basculerFile(sit: Situation, id: string): Situation {
  return modifier(sit, id, (a) => {
    const { file: _ancien, ...reste } = a;
    return a.file ? reste : { ...reste, file: true };
  });
}

/** Renomme une aussière ; un nom vide rend le nom déduit. */
export function renommerAussiere(sit: Situation, id: string, nom: string): Situation {
  const propre = nom.trim().slice(0, 40);
  return modifier(sit, id, (a) => {
    const { nom: _ancien, ...reste } = a;
    return propre ? { ...reste, nom: propre } : reste;
  });
}

/** Règle le plafond d'aussières, borné et jamais sous le nombre d'aussières en place. */
export function reglerPlafond(sit: Situation, valeur: number): Situation {
  const min = Math.max(PLAFOND_DEFAUT, sit.aussieres.length);
  const p = Math.min(PLAFOND_MAX, Math.max(min, Math.round(valeur)));
  if (p === PLAFOND_DEFAUT) {
    const { plafondAussieres: _ancien, ...reste } = sit;
    return reste;
  }
  return { ...sit, plafondAussieres: p };
}

/** Pas du déplacement du bateau le long du quai (m). */
export const PAS_DEPLACEMENT = 0.5;
/** Écart maximal du bateau à sa position d'origine (m) : il reste entier à l'écran sans bouger la caméra. */
export const DEPLACEMENT_MAX = 4;

/** Avance du bateau depuis sa position d'origine, comptée vers l'étrave (m). */
function avance(sit: Pick<Situation, 'bateau'>, origine: Pick<Situation, 'bateau'>): number {
  return bowSign(sit) * (sit.bateau.x - origine.bateau.x);
}

/**
 * Positions extrêmes (x monde) où l'élève peut placer le bateau : au plus
 * DEPLACEMENT_MAX de sa position d'origine, et sans s'approcher d'un voisin à
 * moins de ECART_VOISIN_MIN. Bornes alignées sur le pas de déplacement.
 */
export function bornesDeplacement(sit: Situation, origine: Pick<Situation, 'bateau'>): [number, number] {
  const x0 = origine.bateau.x;
  const sens = bowSign(sit);
  let lo = x0 - DEPLACEMENT_MAX, hi = x0 + DEPLACEMENT_MAX;
  // Course possible vers l'étrave (voisin avant) et vers le tableau (voisin arrière), en monde.
  const versAvant = sit.voisins?.avant !== undefined ? sit.voisins.avant - ECART_VOISIN_MIN : Infinity;
  const versArriere = sit.voisins?.arriere !== undefined ? sit.voisins.arriere - ECART_VOISIN_MIN : Infinity;
  const versPlus = sens === 1 ? versAvant : versArriere;
  const versMoins = sens === 1 ? versArriere : versAvant;
  hi = Math.min(hi, sit.bateau.x + versPlus);
  lo = Math.max(lo, sit.bateau.x - versMoins);
  const e = 1e-9;
  return [
    arrondi(x0 + Math.ceil((lo - x0) / PAS_DEPLACEMENT - e) * PAS_DEPLACEMENT),
    arrondi(x0 + Math.floor((hi - x0) / PAS_DEPLACEMENT + e) * PAS_DEPLACEMENT),
  ];
}

/**
 * Place le bateau à l'abscisse `x` le long du quai, arrondie au pas et bornée
 * autour de sa position dans la situation d'origine et par les voisins (voir
 * bornesDeplacement). Les aussières restent tournées sur leurs bittes, comme
 * les fils punaisés quand on fait glisser le tissu : leur position relative au
 * bateau est recalculée, leur longueur et leur nom déduit suivent. Les voisins
 * restent en place, comme d'autres bouts de tissu sur la table : leur écart
 * change. Renvoie la même situation si la position ne change pas.
 */
export function deplacerBateau(sit: Situation, origine: Pick<Situation, 'bateau'>, x: number): Situation {
  const x0 = origine.bateau.x;
  const [lo, hi] = bornesDeplacement(sit, origine);
  const vise = x0 + Math.round((x - x0) / PAS_DEPLACEMENT) * PAS_DEPLACEMENT;
  const nx = arrondi(Math.min(hi, Math.max(lo, vise)));
  if (nx === sit.bateau.x) return sit;
  const bateau = { ...sit.bateau, x: nx };
  const next: Situation = {
    ...sit,
    bateau,
    aussieres: sit.aussieres.map((a) => ({ ...a, bitte: bitteDepuisMonde({ bateau }, bitteVersMonde(sit, a.bitte)) })),
  };
  if (sit.voisins) {
    const d = bowSign(sit) * (nx - sit.bateau.x);
    const v: Partial<Record<CoteVoisin, number>> = {};
    if (sit.voisins.avant !== undefined) v.avant = arrondi(sit.voisins.avant - d);
    if (sit.voisins.arriere !== undefined) v.arriere = arrondi(sit.voisins.arriere + d);
    next.voisins = v;
  }
  return next;
}

/** Écarts proposés pour un voisin dans l'éditeur (m) : serré et large. */
export const ECARTS_VOISIN = { serre: 1, large: 3 } as const;

/**
 * Écart d'un voisin mesuré depuis la place d'origine du bateau, ou null sans
 * voisin de ce côté. C'est la valeur que règle l'éditeur : elle ne change pas
 * quand on fait glisser le bateau.
 */
export function ecartVoisin(sit: Situation, origine: Pick<Situation, 'bateau'>, cote: CoteVoisin): number | null {
  const e = sit.voisins?.[cote];
  if (e === undefined) return null;
  return arrondi(e + (cote === 'avant' ? 1 : -1) * avance(sit, origine));
}

/**
 * Place un voisin d'un côté, à l'écart donné de la place d'origine du bateau,
 * ou le retire (null). Refusé si le bateau, déplacé, est trop près de cette place.
 */
export function reglerVoisin(sit: Situation, origine: Pick<Situation, 'bateau'>, cote: CoteVoisin, ecart: number | null): Situation {
  const { voisins: anciens, ...reste } = sit;
  const voisins: Partial<Record<CoteVoisin, number>> = { ...anciens };
  if (ecart === null) {
    delete voisins[cote];
  } else {
    const relatif = arrondi(ecart - (cote === 'avant' ? 1 : -1) * avance(sit, origine));
    if (relatif < ECART_VOISIN_MIN) {
      throw new EditionError(`Pas assez de place ${cote === 'avant' ? 'devant' : 'derrière'} le bateau pour ce voisin : ramenez le bateau vers sa place d’origine.`);
    }
    voisins[cote] = relatif;
  }
  return Object.keys(voisins).length > 0 ? { ...reste, voisins } : reste;
}

function arrondi(v: number): number {
  return Math.round(v * 100) / 100 + 0;
}

function modifier(sit: Situation, id: string, f: (a: SituationLine) => SituationLine): Situation {
  return { ...sit, aussieres: sit.aussieres.map((a) => (a.id === id ? f(a) : a)) };
}
