// Édition des aussières d'une situation, pendant la préparation.
// Fonctions pures : chacune renvoie une nouvelle situation, ou lève une
// EditionError au message lisible. Aucune dépendance au navigateur.

import { HALF_LENGTH, cleatPosition } from '../sim/geometry.ts';
import {
  ECART_QUAI_MIN, bitteDepuisSupport, bitteRepereBateau, bitteVersSupport, bowSign, ecartVoisinLarge, perpendiculaire,
  quaySide, surLaRangee,
  type Placement,
} from './quai.ts';
import {
  ECART_VOISIN_MIN, PLAFOND_DEFAUT, PLAFOND_MAX, cotesVoisin, plafond,
  type Cleat, type CoteVoisin, type SensHelice, type Situation, type SituationLine, type WindDirection,
} from './schema.ts';

/**
 * Taquets proposés dans l'éditeur, quelle que soit la situation : deux à l'étrave, deux au
 * maître-bau et deux à l'arrière, côté support et côté large.
 */
export const TAQUETS_EDITABLES: readonly Cleat[] = [
  'etrave', 'etrave-large', 'maitre-bau', 'maitre-bau-large', 'arriere', 'arriere-large',
];

/** Taquet de maître-bau, d'un bord ou de l'autre. */
const auMaitreBau = (taquet: Cleat): boolean => taquet === 'maitre-bau' || taquet === 'maitre-bau-large';

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
 * Le calcul se fait en repère bateau (le long du bateau et vers le support) :
 * il ne dépend donc pas du bord au quai. En perpendiculaire, il s'applique tel
 * quel aux bittes du catway et à celles du quai.
 */
export function nomDeduit(sit: Placement, a: Pick<SituationLine, 'taquet' | 'bitte' | 'sur'>): string {
  const [xc, yc] = cleatPosition(a.taquet, 1);
  const [xb, yb] = bitteRepereBateau(sit, a);
  // Écart le long du bateau (positif vers l'avant) et écart vers le support, du taquet à la bitte.
  const along = xb - xc;
  const across = yb - yc;
  const angle = (Math.atan2(Math.abs(along), Math.abs(across)) * 180) / Math.PI;
  const avant = xc > 0;
  if (auMaitreBau(a.taquet)) {
    if (angle < SEUIL_TRAVERSIER_DEG) return 'Traversier au maître-bau';
    // Nommée par ce qu'elle retient : bitte en arrière, elle empêche d'avancer, comme la garde avant.
    return `Garde ${along < 0 ? 'avant' : 'arrière'} au maître-bau`;
  }
  const bout = avant ? 'avant' : 'arrière';
  if (angle < SEUIL_TRAVERSIER_DEG) return `Traversier ${bout}`;
  // Pointe : vers l'extérieur du bateau ; garde : vers l'intérieur.
  const pointe = avant ? along > 0 : along < 0;
  return `${pointe ? 'Pointe' : 'Garde'} ${bout}`;
}

/** Bord d'une aussière : celui de son taquet, bâbord ou tribord. */
export function bordAussiere(sit: Placement, a: Pick<SituationLine, 'taquet'>): 'bâbord' | 'tribord' {
  // Côté du taquet dans le repère du bateau tourné vers le support : +1 vers le support, -1 vers le large.
  const cote = Math.sign(cleatPosition(a.taquet, 1)[1]);
  return cote * quaySide(sit) > 0 ? 'bâbord' : 'tribord';
}

/**
 * Noms affichés de toutes les aussières, dans l'ordre de la situation.
 * Un nom choisi est gardé tel quel. Des noms déduits identiques sont départagés par
 * leur bord quand chacune est sur un bord différent (« Pointe arrière bâbord » et
 * « Pointe arrière tribord ») ; sinon, ils sont numérotés.
 */
export function nomsAffiches(sit: Pick<Situation, 'quai' | 'bateau' | 'aussieres'>): string[] {
  const deduits = sit.aussieres.map((a) => (a.nom ? null : nomDeduit(sit, a)));
  const bords = sit.aussieres.map((a) => bordAussiere(sit, a));
  const groupes = new Map<string, number[]>();
  deduits.forEach((n, i) => { if (n) groupes.set(n, [...(groupes.get(n) ?? []), i]); });
  const parBord = new Set<string>();
  for (const [n, idx] of groupes) {
    const b = idx.map((i) => bords[i]);
    if (idx.length > 1 && new Set(b).size === b.length) parBord.add(n);
  }
  const vus = new Map<string, number>();
  return sit.aussieres.map((a, i) => {
    const n = deduits[i];
    if (!n) return a.nom as string;
    if ((groupes.get(n)?.length ?? 0) < 2) return n;
    if (parBord.has(n)) return `${n} ${bords[i]}`;
    const k = (vus.get(n) ?? 0) + 1;
    vus.set(n, k);
    return `${n} ${k}`;
  });
}

/**
 * Ajoute une aussière tendue entre un taquet et une bitte (position relative au bateau ;
 * en perpendiculaire, `sur` = 'quai' désigne une bitte du quai plutôt que du catway).
 */
export function ajouterAussiere(sit: Situation, taquet: Cleat, bitte: number, sur?: 'quai'): Situation {
  if (sur && !perpendiculaire(sit)) throw new EditionError('Cette position ne correspond à aucune bitte du quai.');
  if (!surLaRangee(sit, { bitte, sur })) {
    throw new EditionError(`Cette position ne correspond à aucune bitte du ${perpendiculaire(sit) && !sur ? 'catway' : 'quai'}.`);
  }
  if (sit.aussieres.some((a) => a.taquet === taquet && a.bitte === bitte && a.sur === sur)) {
    throw new EditionError('Une aussière relie déjà ce taquet à cette bitte.');
  }
  const max = plafond(sit);
  if (sit.aussieres.length >= max) {
    throw new EditionError(`Plafond atteint : ${max} aussières au maximum. Il se règle dans les options avancées.`);
  }
  let n = sit.aussieres.length + 1;
  while (sit.aussieres.some((a) => a.id === `aussiere-${n}`)) n++;
  const nouvelle: SituationLine = { id: `aussiere-${n}`, taquet, bitte, mou: 0 };
  if (sur) nouvelle.sur = sur;
  return { ...sit, aussieres: [...sit.aussieres, nouvelle] };
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

/**
 * Règle le pas d'hélice : hélice à droite, à gauche, ou aucun (`null`). Sans option
 * active, le champ `options` disparaît : la situation redevient celle du socle.
 */
export function reglerPasHelice(sit: Situation, sens: SensHelice | null): Situation {
  const { options: _anciennes, ...reste } = sit;
  return sens === null ? reste : { ...reste, options: { pasHelice: sens } };
}

/** Pas du déplacement du bateau le long du quai ou du catway (m). */
export const PAS_DEPLACEMENT = 0.5;
/** Écart maximal du bateau à sa position d'origine (m) : il reste entier à l'écran sans bouger la caméra. */
export const DEPLACEMENT_MAX = 4;

/** Avance du bateau depuis sa position d'origine, comptée vers l'étrave (m). */
function avance(sit: Placement, origine: Pick<Situation, 'bateau'>): number {
  return bowSign(sit) * (sit.bateau.x - origine.bateau.x);
}

/**
 * Positions extrêmes (le long du support) où l'élève peut placer le bateau : au plus
 * DEPLACEMENT_MAX de sa position d'origine, sans s'approcher d'un voisin à moins de
 * ECART_VOISIN_MIN, ni, en perpendiculaire, du quai à moins de ECART_QUAI_MIN.
 * Bornes alignées sur le pas de déplacement.
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
  // En perpendiculaire, la position est comptée depuis le bord du quai : le bout du bateau s'arrête avant.
  if (perpendiculaire(sit)) lo = Math.max(lo, HALF_LENGTH + ECART_QUAI_MIN);
  const e = 1e-9;
  return [
    arrondi(x0 + Math.ceil((lo - x0) / PAS_DEPLACEMENT - e) * PAS_DEPLACEMENT),
    arrondi(x0 + Math.floor((hi - x0) / PAS_DEPLACEMENT + e) * PAS_DEPLACEMENT),
  ];
}

/**
 * Place le bateau à la position `x` le long du support (quai ou catway), arrondie
 * au pas et bornée autour de sa position dans la situation d'origine, par les
 * voisins et par le quai (voir bornesDeplacement). Les aussières restent tournées
 * sur leurs bittes, comme les fils punaisés quand on fait glisser le tissu : leur
 * position relative au bateau est recalculée, leur longueur et leur nom déduit
 * suivent. En perpendiculaire, l'axe du bateau ne bouge pas le long du quai : les
 * bittes du quai gardent leur position relative. Les voisins restent en place,
 * comme d'autres bouts de tissu sur la table : le long du quai, leur écart change ;
 * en perpendiculaire, leur distance au quai ne dépend pas du bateau et ne change
 * pas. Renvoie la même situation si la position ne change pas.
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
    aussieres: sit.aussieres.map((a) => (a.sur === 'quai'
      ? a
      : { ...a, bitte: bitteDepuisSupport({ ...sit, bateau }, bitteVersSupport(sit, a.bitte)) })),
  };
  if (sit.voisins && !perpendiculaire(sit)) {
    const d = bowSign(sit) * (nx - sit.bateau.x);
    const v: Partial<Record<CoteVoisin, number>> = {};
    if (sit.voisins.avant !== undefined) v.avant = arrondi(sit.voisins.avant - d);
    if (sit.voisins.arriere !== undefined) v.arriere = arrondi(sit.voisins.arriere + d);
    next.voisins = v;
  }
  return next;
}

/** Repères du vent échangés quand le bateau change de bord : le vent garde sa direction dans le port. */
const VENT_MIROIR_QUAI: Record<string, string> = { avant: 'arriere', arriere: 'avant' };
const VENT_MIROIR_CATWAY: Record<string, string> = { catway: 'large', large: 'catway' };

/** Direction du vent, dans les repères d'un bateau retourné, qui souffle du même côté du port. */
function ventMiroir(direction: WindDirection, perp: boolean): WindDirection {
  const echange = perp ? VENT_MIROIR_CATWAY : VENT_MIROIR_QUAI;
  return direction.split('-').map((r) => echange[r] ?? r).join('-') as WindDirection;
}

/**
 * Le long du quai, place le bateau en `x` en emportant ses aussières (leur `bitte`
 * relative ne change pas) ; les voisins restent en place, leur écart change.
 */
function decaler(sit: Situation, x: number): Situation {
  if (x === sit.bateau.x) return sit;
  const next: Situation = { ...sit, bateau: { ...sit.bateau, x } };
  if (sit.voisins) {
    const d = bowSign(sit) * (x - sit.bateau.x);
    const v: Partial<Record<CoteVoisin, number>> = {};
    if (sit.voisins.avant !== undefined) v.avant = arrondi(sit.voisins.avant - d);
    if (sit.voisins.arriere !== undefined) v.arriere = arrondi(sit.voisins.arriere + d);
    next.voisins = v;
  }
  return next;
}

/**
 * Retourne le bateau, bâbord ou tribord au support (quai ou catway). Le long du quai,
 * il pivote sur place autour de son centre ; en perpendiculaire, il passe de l'autre
 * côté de son catway, avec le même bout au quai.
 *
 * Les aussières passent en miroir : leur taquet (côté support ou côté large) et leur
 * bitte relative au bateau ne changent pas, si bien que chacune garde son rôle, son
 * mou, son état et son nom choisi. Le vent garde sa direction dans le port : son
 * repère change. Le long du quai, les voisins restent à leur place, retournés comme
 * le bateau (ils ont son cap) : le voisin devant passe derrière. En perpendiculaire,
 * leurs places se rapportent au bateau et le suivent, comme le second catway.
 *
 * Le long du quai, la rangée de bittes n'est symétrique qu'autour des mètres entiers :
 * bateau sur un demi-mètre, le miroir d'une bitte tomberait entre deux bittes. Le
 * bateau se décale alors de 1 m vers sa position d'origine (sinon dans l'autre sens),
 * dans les bornes du déplacement. Renvoie la même situation si le bord ne change pas.
 */
export function changerBord(sit: Situation, origine: Pick<Situation, 'bateau'>, bord: 'babord' | 'tribord'): Situation {
  if (bord === sit.bateau.bordAuQuai) return sit;
  const perp = perpendiculaire(sit);
  const retourne: Situation = {
    ...sit,
    bateau: { ...sit.bateau, bordAuQuai: bord },
    vent: { ...sit.vent, direction: ventMiroir(sit.vent.direction, perp) },
  };
  if (perp) return retourne;
  if (sit.voisins) {
    const { avant, arriere } = sit.voisins;
    const v: Partial<Record<CoteVoisin, number>> = {};
    if (arriere !== undefined) v.avant = arriere;
    if (avant !== undefined) v.arriere = avant;
    retourne.voisins = v;
  }
  const x = sit.bateau.x;
  const versOrigine = origine.bateau.x < x ? -1 : 1;
  for (const nx of [x, arrondi(x + versOrigine), arrondi(x - versOrigine)]) {
    const candidat = decaler(retourne, nx);
    const [lo, hi] = bornesDeplacement(candidat, origine);
    if (nx < lo - 1e-9 || nx > hi + 1e-9) continue;
    if (candidat.aussieres.every((a) => surLaRangee(candidat, a))) return candidat;
  }
  throw new EditionError('Pas de place pour retourner le bateau ici : ramenez-le vers sa place d’origine.');
}

/** Écarts proposés pour un voisin dans l'éditeur, le long du quai (m) : serré et large. */
export const ECARTS_VOISIN = { serre: 1, large: 3 } as const;

/**
 * En perpendiculaire, distance au quai de l'étrave d'un voisin placé dans l'éditeur :
 * celle du bout du bateau tourné vers le quai, dans la situation d'origine, si bien
 * que les deux coques sont alignées au départ.
 */
export function etraveVoisinCatway(origine: Pick<Situation, 'bateau'>): number {
  return arrondi(origine.bateau.x - HALF_LENGTH);
}

/**
 * Réglage d'un voisin dans l'éditeur, ou null sans voisin de ce côté. Le long du
 * quai, c'est l'écart mesuré depuis la place d'origine du bateau : il ne change pas
 * quand on fait glisser le bateau. En perpendiculaire, c'est la distance de l'étrave
 * du voisin au quai, qui ne dépend pas du bateau.
 */
export function ecartVoisin(sit: Situation, origine: Pick<Situation, 'bateau'>, cote: CoteVoisin): number | null {
  const e = sit.voisins?.[cote];
  if (e === undefined) return null;
  if (cote === 'catway' || cote === 'large') return e;
  return arrondi(e + (cote === 'avant' ? 1 : -1) * avance(sit, origine));
}

/**
 * Place un voisin d'un côté, ou le retire (null). Le long du quai, `ecart` est compté
 * depuis la place d'origine du bateau, et le voisin est refusé si le bateau, déplacé,
 * est trop près de cette place. En perpendiculaire, `ecart` est la distance de l'étrave
 * du voisin au quai (voir etraveVoisinCatway), et un voisin côté large est refusé si
 * le bateau est trop loin de son catway pour lui laisser la place.
 */
export function reglerVoisin(sit: Situation, origine: Pick<Situation, 'bateau'>, cote: CoteVoisin, ecart: number | null): Situation {
  const perp = perpendiculaire(sit);
  if (!cotesVoisin(sit.quai.type).includes(cote)) {
    throw new EditionError(perp
      ? 'Sur catway, les voisins se placent côté catway ou côté large.'
      : 'Le long du quai, les voisins se placent devant ou derrière.');
  }
  const { voisins: anciens, ...reste } = sit;
  const voisins: Partial<Record<CoteVoisin, number>> = { ...anciens };
  if (ecart === null) {
    delete voisins[cote];
  } else if (perp) {
    if (cote === 'large' && ecartVoisinLarge(sit) < ECART_VOISIN_MIN) {
      throw new EditionError('Pas assez de place côté large pour un voisin : le bateau est trop loin de son catway.');
    }
    voisins[cote] = arrondi(ecart);
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
