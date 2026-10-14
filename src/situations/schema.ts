// Format des situations (version 1). Un fichier JSON par situation du catalogue ;
// l'éditeur produit le même format.

import {
  BOLLARD_SPACING, ECART_QUAI_MIN, LONGUEUR_CATWAY, ecartVoisinLarge, surLaRangee, type BoutAuQuai, type TypeQuai,
} from './quai.ts';
import { HALF_LENGTH } from '../sim/geometry.ts';

/** Directions du vent le long du quai : du quai, du large, de l'avant ou de l'arrière du bateau. */
export const WIND_DIRECTIONS = [
  'quai', 'large', 'avant', 'arriere',
  'quai-avant', 'quai-arriere', 'large-avant', 'large-arriere',
] as const;
/**
 * Directions du vent en perpendiculaire, en repères du port : du catway, du large
 * (côté opposé au catway), du quai, du chenal (bout opposé au quai).
 */
export const WIND_DIRECTIONS_CATWAY = [
  'catway', 'large', 'quai', 'chenal',
  'catway-quai', 'catway-chenal', 'large-quai', 'large-chenal',
] as const;
export type WindDirection = (typeof WIND_DIRECTIONS)[number] | (typeof WIND_DIRECTIONS_CATWAY)[number];

/** Directions du vent proposées pour un type de quai. */
export function directionsVent(type: TypeQuai): readonly WindDirection[] {
  return type === 'perpendiculaire' ? WIND_DIRECTIONS_CATWAY : WIND_DIRECTIONS;
}

export const TYPES_QUAI = ['long-side', 'perpendiculaire'] as const;
export const BOUTS_AU_QUAI = ['etrave', 'arriere'] as const;

export const WIND_FORCES = ['aucun', 'faible', 'soutenu'] as const;
export const CLEATS = ['etrave', 'etrave-large', 'arriere', 'arriere-large', 'maitre-bau'] as const;
export type Cleat = (typeof CLEATS)[number];

/** Côtés du bateau où l'on peut placer un voisin, le long du quai. */
export const COTES_VOISIN = ['avant', 'arriere'] as const;
/**
 * Côtés du bateau où l'on peut placer un voisin en perpendiculaire : de l'autre flanc
 * du catway du bateau, et côté large, contre le second catway.
 */
export const COTES_VOISIN_CATWAY = ['catway', 'large'] as const;
export type CoteVoisin = (typeof COTES_VOISIN)[number] | (typeof COTES_VOISIN_CATWAY)[number];
/** Écart minimal et maximal entre le bateau et un voisin au départ (m). */
export const ECART_VOISIN_MIN = 0.5;
export const ECART_VOISIN_MAX = 20;
/** En perpendiculaire, distance maximale entre l'étrave d'un voisin et le bord du quai (m). */
export const ETRAVE_VOISIN_MAX = 5;

/** Côtés où l'on peut placer un voisin selon le type de quai. */
export function cotesVoisin(type: TypeQuai): readonly CoteVoisin[] {
  return type === 'perpendiculaire' ? COTES_VOISIN_CATWAY : COTES_VOISIN;
}

/** Libellé d'un côté de voisin dans les messages. */
const NOM_COTE: Record<CoteVoisin, string> = {
  avant: 'avant', arriere: 'arrière', catway: 'côté catway', large: 'côté large',
};

/** Plafond d'aussières par défaut, et bornes de son réglage. */
export const PLAFOND_DEFAUT = 6;
export const PLAFOND_MAX = 12;

export interface SituationLine {
  id: string;
  /** nom choisi ; absent, le nom est déduit de la géométrie (voir edit.ts) */
  nom?: string;
  /** taquet du bateau ; « arriere » est le taquet arrière côté quai (ou catway) */
  taquet: Cleat;
  /**
   * en perpendiculaire, « quai » pour une bitte de la rangée du quai ; absent, la
   * bitte est sur la rangée du support (le quai le long du quai, le catway en perpendiculaire)
   */
  sur?: 'quai';
  /**
   * position de la bitte le long du support (m), depuis le centre du bateau au départ,
   * positive vers l'avant ; elle doit tomber sur la rangée de bittes du support.
   * Bitte du quai en perpendiculaire : position le long du quai depuis l'axe du bateau,
   * positive vers le catway
   */
  bitte: number;
  /** mou au départ (m) ; 0 = aussière tendue */
  mou: number;
  /** aussière choquée dès le départ : elle file dès la mise en mouvement (bloquée si absent) */
  file?: boolean;
}

export interface Situation {
  format: 1;
  id: string;
  titre: string;
  description: string;
  /** long du quai, ou perpendiculaire, le long d'un catway */
  quai: { type: TypeQuai };
  bateau: {
    /**
     * position du centre le long du support (m) : abscisse monde le long du quai ;
     * en perpendiculaire, distance au bord du quai, comptée le long du catway
     */
    x: number;
    /** écart entre le flanc et le support : bord du quai ou flanc du catway (m) */
    distanceQuai: number;
    /** flanc tourné vers le support */
    bordAuQuai: 'babord' | 'tribord';
    /** en perpendiculaire seulement : bout du bateau tourné vers le quai */
    boutAuQuai?: BoutAuQuai;
  };
  aussieres: SituationLine[];
  /** nombre maximal d'aussières (PLAFOND_DEFAUT si absent) */
  plafondAussieres?: number;
  vent: { direction: WindDirection; force: (typeof WIND_FORCES)[number] };
  /**
   * bateaux voisins ; un côté absent n'a pas de voisin. Le long du quai, amarrés
   * le long du même quai : écart (m) entre l'étrave (avant) ou le tableau arrière
   * (arriere) du bateau au départ et le voisin. En perpendiculaire, de l'autre
   * flanc du catway (catway) ou contre le second catway (large), étrave au quai :
   * distance (m) entre l'étrave du voisin et le bord du quai.
   */
  voisins?: Partial<Record<CoteVoisin, number>>;
}

/** Plafond d'aussières effectif d'une situation. */
export function plafond(sit: Pick<Situation, 'plafondAussieres'>): number {
  return sit.plafondAussieres ?? PLAFOND_DEFAUT;
}

export class SituationError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function oneOf<T extends string>(v: unknown, values: readonly T[], where: string): T {
  if (typeof v !== 'string' || !values.includes(v as T)) {
    throw new SituationError(`${where} doit valoir ${values.map((x) => `« ${x} »`).join(', ')}.`);
  }
  return v as T;
}

/** Valide une situation lue depuis un JSON. Lève une SituationError au message lisible. */
export function parseSituation(input: unknown): Situation {
  if (!isObj(input)) throw new SituationError('La situation doit être un objet JSON.');
  if (input.format !== 1) throw new SituationError('Format de situation non pris en charge (attendu : 1).');
  for (const k of ['id', 'titre', 'description'] as const) {
    if (!isStr(input[k])) throw new SituationError(`Le champ « ${k} » est obligatoire.`);
  }
  const id = input.id as string;
  const quai = input.quai;
  if (!isObj(quai)) throw new SituationError(`${id} : le champ « quai » est obligatoire.`);
  const type = oneOf(quai.type, TYPES_QUAI, `${id} : quai.type`);
  const perp = type === 'perpendiculaire';

  const bateau = input.bateau;
  if (!isObj(bateau) || !isNum(bateau.x) || !isNum(bateau.distanceQuai)) {
    throw new SituationError(`${id} : « bateau » doit préciser x et distanceQuai.`);
  }
  if (bateau.distanceQuai < 0) throw new SituationError(`${id} : bateau.distanceQuai ne peut pas être négatif.`);
  const bord = oneOf(bateau.bordAuQuai, ['babord', 'tribord'] as const, `${id} : bateau.bordAuQuai`);
  let bout: BoutAuQuai | undefined;
  if (perp) {
    bout = oneOf(bateau.boutAuQuai, BOUTS_AU_QUAI, `${id} : en perpendiculaire, bateau.boutAuQuai`);
    if (bateau.x - HALF_LENGTH < ECART_QUAI_MIN - 1e-9) {
      throw new SituationError(`${id} : le bout du bateau doit rester à ${ECART_QUAI_MIN} m au moins du quai (bateau.x ≥ ${HALF_LENGTH + ECART_QUAI_MIN}).`);
    }
  } else if (bateau.boutAuQuai !== undefined) {
    throw new SituationError(`${id} : bateau.boutAuQuai ne sert qu'en perpendiculaire.`);
  }
  const navire: Situation['bateau'] = { x: bateau.x, distanceQuai: bateau.distanceQuai, bordAuQuai: bord };
  if (bout) navire.boutAuQuai = bout;

  if (!Array.isArray(input.aussieres)) throw new SituationError(`${id} : « aussieres » doit être une liste.`);
  const placement = { quai: { type }, bateau: navire };
  const ids = new Set<string>();
  const liens = new Set<string>();
  const aussieres: SituationLine[] = input.aussieres.map((a: unknown, i: number) => {
    const where = `${id} : aussière n° ${i + 1}`;
    if (!isObj(a) || !isStr(a.id) || !isNum(a.bitte) || !isNum(a.mou)) {
      throw new SituationError(`${where} doit préciser id, taquet, bitte et mou.`);
    }
    if (a.nom !== undefined && !isStr(a.nom)) throw new SituationError(`${where} : le nom, s'il est donné, ne peut pas être vide.`);
    if (ids.has(a.id)) throw new SituationError(`${where} : identifiant « ${a.id} » en double.`);
    if (a.file !== undefined && typeof a.file !== 'boolean') throw new SituationError(`${where} : « file » vaut true ou false.`);
    if (a.mou < 0) throw new SituationError(`${where} : le mou ne peut pas être négatif.`);
    if (a.sur !== undefined) {
      if (!perp) throw new SituationError(`${where} : « sur » ne sert qu'en perpendiculaire.`);
      oneOf(a.sur, ['quai'] as const, `${where} : sur`);
    }
    const sur = a.sur === 'quai' ? 'quai' as const : undefined;
    if (!surLaRangee(placement, { bitte: a.bitte, sur })) {
      throw new SituationError(perp && !sur
        ? `${where} : la bitte (${a.bitte} m) n'est pas sur la rangée de bittes du catway, espacées de ${BOLLARD_SPACING} m depuis le quai sur ${LONGUEUR_CATWAY} m.`
        : `${where} : la bitte (${a.bitte} m) n'est pas sur la rangée de bittes du quai, espacées de ${BOLLARD_SPACING} m.`);
    }
    const taquet = oneOf(a.taquet, CLEATS, `${where} : taquet`);
    const lien = `${taquet}@${sur ?? ''}${a.bitte}`;
    if (liens.has(lien)) throw new SituationError(`${where} : une autre aussière relie déjà ce taquet à cette bitte.`);
    ids.add(a.id);
    liens.add(lien);
    const line: SituationLine = { id: a.id, taquet, bitte: a.bitte, mou: a.mou };
    if (sur) line.sur = sur;
    if (a.nom !== undefined) line.nom = a.nom as string;
    if (a.file === true) line.file = true;
    return line;
  });

  let plafondAussieres: number | undefined;
  if (input.plafondAussieres !== undefined) {
    const p = input.plafondAussieres;
    if (!Number.isInteger(p) || (p as number) < PLAFOND_DEFAUT || (p as number) > PLAFOND_MAX) {
      throw new SituationError(`${id} : plafondAussieres doit être un entier de ${PLAFOND_DEFAUT} à ${PLAFOND_MAX}.`);
    }
    plafondAussieres = p as number;
  }
  const max = plafondAussieres ?? PLAFOND_DEFAUT;
  if (aussieres.length > max) {
    throw new SituationError(`${id} : ${aussieres.length} aussières pour un plafond de ${max}.`);
  }

  const vent = input.vent;
  if (!isObj(vent)) throw new SituationError(`${id} : le champ « vent » est obligatoire.`);
  const sit: Situation = {
    format: 1,
    id,
    titre: input.titre as string,
    description: input.description as string,
    quai: { type },
    bateau: navire,
    aussieres,
    vent: {
      direction: oneOf(vent.direction, directionsVent(type), `${id} : vent.direction`),
      force: oneOf(vent.force, WIND_FORCES, `${id} : vent.force`),
    },
  };
  if (plafondAussieres !== undefined) sit.plafondAussieres = plafondAussieres;

  if (input.voisins !== undefined) {
    const v = input.voisins;
    const forme = perp ? '{ "catway": distance, "large": distance }' : '{ "avant": écart, "arriere": écart }';
    if (!isObj(v)) throw new SituationError(`${id} : « voisins » doit être un objet (${forme}).`);
    const voisins: Partial<Record<CoteVoisin, number>> = {};
    for (const k of Object.keys(v)) {
      const cote = oneOf(k, cotesVoisin(type), `${id} : chaque côté de « voisins »`);
      const e = v[k];
      if (perp) {
        if (!isNum(e) || e < ECART_QUAI_MIN || e > ETRAVE_VOISIN_MAX) {
          throw new SituationError(`${id} : l'étrave du voisin ${NOM_COTE[cote]} doit être à ${ECART_QUAI_MIN} à ${ETRAVE_VOISIN_MAX} m du quai.`);
        }
        if (cote === 'large' && ecartVoisinLarge(sit) < ECART_VOISIN_MIN) {
          throw new SituationError(`${id} : le bateau est trop loin de son catway pour un voisin côté large.`);
        }
      } else if (!isNum(e) || e < ECART_VOISIN_MIN || e > ECART_VOISIN_MAX) {
        throw new SituationError(`${id} : l'écart du voisin ${NOM_COTE[cote]} doit être un nombre de ${ECART_VOISIN_MIN} à ${ECART_VOISIN_MAX} m.`);
      }
      voisins[cote] = e;
    }
    if (Object.keys(voisins).length > 0) sit.voisins = voisins;
  }
  return sit;
}
