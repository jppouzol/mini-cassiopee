// Format des situations (version 1). Un fichier JSON par situation du catalogue ;
// l'éditeur produira le même format.

export const WIND_DIRECTIONS = [
  'quai', 'large', 'avant', 'arriere',
  'quai-avant', 'quai-arriere', 'large-avant', 'large-arriere',
] as const;
export type WindDirection = (typeof WIND_DIRECTIONS)[number];

export const WIND_FORCES = ['aucun', 'faible', 'soutenu'] as const;
export const CLEATS = ['etrave', 'arriere', 'arriere-large', 'maitre-bau'] as const;

export interface SituationLine {
  id: string;
  nom: string;
  /** taquet du bateau ; « arriere » est le taquet arrière côté quai */
  taquet: (typeof CLEATS)[number];
  /** position de la bitte le long du quai (m), depuis le centre du bateau au départ, positive vers l'avant */
  bitte: number;
  /** mou au départ (m) ; 0 = aussière tendue */
  mou: number;
}

export interface Situation {
  format: 1;
  id: string;
  titre: string;
  description: string;
  quai: { type: 'long-side' };
  bateau: {
    x: number;
    /** écart entre le flanc et le bord du quai (m) */
    distanceQuai: number;
    bordAuQuai: 'babord' | 'tribord';
  };
  aussieres: SituationLine[];
  vent: { direction: WindDirection; force: (typeof WIND_FORCES)[number] };
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
  oneOf(quai.type, ['long-side'] as const, `${id} : quai.type`);

  const bateau = input.bateau;
  if (!isObj(bateau) || !isNum(bateau.x) || !isNum(bateau.distanceQuai)) {
    throw new SituationError(`${id} : « bateau » doit préciser x et distanceQuai.`);
  }
  if (bateau.distanceQuai < 0) throw new SituationError(`${id} : bateau.distanceQuai ne peut pas être négatif.`);
  const bord = oneOf(bateau.bordAuQuai, ['babord', 'tribord'] as const, `${id} : bateau.bordAuQuai`);

  if (!Array.isArray(input.aussieres)) throw new SituationError(`${id} : « aussieres » doit être une liste.`);
  const ids = new Set<string>();
  const aussieres: SituationLine[] = input.aussieres.map((a: unknown, i: number) => {
    const where = `${id} : aussière n° ${i + 1}`;
    if (!isObj(a) || !isStr(a.id) || !isStr(a.nom) || !isNum(a.bitte) || !isNum(a.mou)) {
      throw new SituationError(`${where} doit préciser id, nom, taquet, bitte et mou.`);
    }
    if (ids.has(a.id)) throw new SituationError(`${where} : identifiant « ${a.id} » en double.`);
    if (a.mou < 0) throw new SituationError(`${where} : le mou ne peut pas être négatif.`);
    ids.add(a.id);
    return { id: a.id, nom: a.nom, taquet: oneOf(a.taquet, CLEATS, `${where} : taquet`), bitte: a.bitte, mou: a.mou };
  });

  const vent = input.vent;
  if (!isObj(vent)) throw new SituationError(`${id} : le champ « vent » est obligatoire.`);
  return {
    format: 1,
    id,
    titre: input.titre as string,
    description: input.description as string,
    quai: { type: 'long-side' },
    bateau: { x: bateau.x, distanceQuai: bateau.distanceQuai, bordAuQuai: bord },
    aussieres,
    vent: {
      direction: oneOf(vent.direction, WIND_DIRECTIONS, `${id} : vent.direction`),
      force: oneOf(vent.force, WIND_FORCES, `${id} : vent.force`),
    },
  };
}
