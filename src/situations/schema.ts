// Format des situations (version 1). Un fichier JSON par situation du catalogue ;
// l'éditeur produit le même format.

import {
  ALLEE_MAX, ALLEE_MIN, BATEAU_LIBRE, BOLLARD_SPACING, ECART_QUAI_MIN, LONGUEUR_CATWAY, ecartVoisinLarge, surLaRangee, type BoutAuQuai, type TypeQuai,
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
/**
 * Directions du vent en situation libre, sans repère du port : par rapport au bateau
 * au départ, de l'avant, de l'arrière, de bâbord, de tribord.
 */
export const WIND_DIRECTIONS_LIBRE = [
  'avant', 'arriere', 'babord', 'tribord',
  'avant-babord', 'avant-tribord', 'arriere-babord', 'arriere-tribord',
] as const;
export type WindDirection =
  | (typeof WIND_DIRECTIONS)[number] | (typeof WIND_DIRECTIONS_CATWAY)[number] | (typeof WIND_DIRECTIONS_LIBRE)[number];

/** Directions du vent proposées pour un type de quai. */
export function directionsVent(type: TypeQuai): readonly WindDirection[] {
  if (type === 'libre') return WIND_DIRECTIONS_LIBRE;
  return type === 'perpendiculaire' ? WIND_DIRECTIONS_CATWAY : WIND_DIRECTIONS;
}

export const TYPES_QUAI = ['long-side', 'perpendiculaire', 'libre'] as const;
export const BOUTS_AU_QUAI = ['etrave', 'arriere'] as const;

export const WIND_FORCES = ['aucun', 'faible', 'soutenu'] as const;
export const CLEATS = ['etrave', 'etrave-large', 'arriere', 'arriere-large', 'maitre-bau', 'maitre-bau-large'] as const;
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

/** Côtés où l'on peut placer un voisin selon le type de quai ; aucun en situation libre. */
export function cotesVoisin(type: TypeQuai): readonly CoteVoisin[] {
  if (type === 'libre') return [];
  return type === 'perpendiculaire' ? COTES_VOISIN_CATWAY : COTES_VOISIN;
}

/** Libellé d'un côté de voisin dans les messages. */
const NOM_COTE: Record<CoteVoisin, string> = {
  avant: 'avant', arriere: 'arrière', catway: 'côté catway', large: 'côté large',
};

/**
 * Sens de rotation de l'hélice, pour le pas d'hélice : à droite (sens des aiguilles
 * d'une montre vue de l'arrière, en marche avant) ou à gauche.
 */
export const SENS_HELICE = ['droite', 'gauche'] as const;
export type SensHelice = (typeof SENS_HELICE)[number];

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
  /**
   * ce que fait l'équipier dès la mise en mouvement : « choque », elle file ; « reprend »,
   * il l'embraque ; absent, elle est bloquée. L'ancien champ « file »: true est lu
   * comme « choque ».
   */
  equipier?: Equipier;
}

/** Ce que fait l'équipier au départ, quand l'aussière n'est pas bloquée. */
export type Equipier = 'choque' | 'reprend';
export const EQUIPIERS: readonly Equipier[] = ['choque', 'reprend'];

export interface Situation {
  format: 1;
  id: string;
  titre: string;
  description: string;
  /** long du quai, perpendiculaire, le long d'un catway, ou libre, sans quai */
  quai: { type: TypeQuai };
  /** absent du fichier en situation libre : la validation y met BATEAU_LIBRE */
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
  /**
   * en perpendiculaire seulement : bateaux en face, de l'autre côté de l'allée. Distance (m)
   * du bord du quai aux arrières des bateaux d'en face ; absent, pas de bateaux en face.
   */
  enFace?: number;
  /** effets avancés ; absents, le comportement de base est inchangé */
  options?: {
    /** pas d'hélice, selon le sens de rotation de l'hélice ; absent, pas de pas d'hélice */
    pasHelice?: SensHelice;
    /** fardage : le vent s'applique vers le bout d'où il vient ; absent, au centre */
    fardage?: true;
  };
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

/** Vent d'une situation, validé pour son type de quai. */
function parseVent(input: Obj, id: string, type: TypeQuai): Situation['vent'] {
  const vent = input.vent;
  if (!isObj(vent)) throw new SituationError(`${id} : le champ « vent » est obligatoire.`);
  return {
    direction: oneOf(vent.direction, directionsVent(type), `${id} : vent.direction`),
    force: oneOf(vent.force, WIND_FORCES, `${id} : vent.force`),
  };
}

/** Options avancées d'une situation, validées ; undefined sans option. */
function parseOptions(input: Obj, id: string): Situation['options'] {
  if (input.options === undefined) return undefined;
  const o = input.options;
  if (!isObj(o)) throw new SituationError(`${id} : « options » doit être un objet ({ "pasHelice": "droite" }).`);
  for (const k of Object.keys(o)) oneOf(k, ['pasHelice', 'fardage'] as const, `${id} : chaque option`);
  const options: NonNullable<Situation['options']> = {};
  if (o.pasHelice !== undefined) options.pasHelice = oneOf(o.pasHelice, SENS_HELICE, `${id} : options.pasHelice`);
  if (o.fardage !== undefined && typeof o.fardage !== 'boolean') {
    throw new SituationError(`${id} : options.fardage doit valoir true ou false.`);
  }
  // Comme « file », seul true est gardé : false équivaut à l'option absente.
  if (o.fardage === true) options.fardage = true;
  return Object.keys(options).length > 0 ? options : undefined;
}

/**
 * Situation libre : le bateau seul, en milieu de port. Ni bateau à placer le long d'un
 * support, ni aussière, ni voisin, ni plafond ; le vent se rapporte au bateau au départ.
 */
function parseLibre(input: Obj, id: string): Situation {
  if (input.bateau !== undefined) throw new SituationError(`${id} : en situation libre, « bateau » est sans objet : le bateau part du milieu du port.`);
  if (!Array.isArray(input.aussieres) || input.aussieres.length > 0) {
    throw new SituationError(`${id} : en situation libre, « aussieres » doit être une liste vide.`);
  }
  for (const k of ['voisins', 'plafondAussieres', 'enFace'] as const) {
    if (input[k] !== undefined) throw new SituationError(`${id} : en situation libre, « ${k} » est sans objet.`);
  }
  const sit: Situation = {
    format: 1,
    id,
    titre: input.titre as string,
    description: input.description as string,
    quai: { type: 'libre' },
    bateau: { ...BATEAU_LIBRE },
    aussieres: [],
    vent: parseVent(input, id, 'libre'),
  };
  const options = parseOptions(input, id);
  if (options) sit.options = options;
  return sit;
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
  if (type === 'libre') return parseLibre(input, id);

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
    const equipier = a.equipier === undefined ? undefined : oneOf(a.equipier, EQUIPIERS, `${where} : equipier`);
    if (a.file === true && equipier !== undefined && equipier !== 'choque') {
      throw new SituationError(`${where} : « file » et « equipier » se contredisent.`);
    }
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
    // « file »: true, ancienne écriture, vaut « choque ».
    if (equipier ?? (a.file === true ? 'choque' : undefined)) line.equipier = equipier ?? 'choque';
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

  const sit: Situation = {
    format: 1,
    id,
    titre: input.titre as string,
    description: input.description as string,
    quai: { type },
    bateau: navire,
    aussieres,
    vent: parseVent(input, id, type),
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

  if (input.enFace !== undefined) {
    if (!perp) throw new SituationError(`${id} : « enFace » ne sert qu'en perpendiculaire, sur catway.`);
    const d = input.enFace;
    const allee = isNum(d) ? d - (navire.x + HALF_LENGTH) : NaN;
    if (!(allee >= ALLEE_MIN - 1e-9 && allee <= ALLEE_MAX + 1e-9)) {
      throw new SituationError(`${id} : « enFace » doit laisser une allée de ${ALLEE_MIN} à ${ALLEE_MAX} m entre le bout du bateau et les bateaux d'en face.`);
    }
    sit.enFace = d as number;
  }

  const options = parseOptions(input, id);
  if (options) sit.options = options;
  return sit;
}
