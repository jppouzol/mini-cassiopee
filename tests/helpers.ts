import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseSituation, type Situation } from '../src/situations/schema.ts';
import { buildState } from '../src/situations/build.ts';
import { tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { toWorld } from '../src/sim/geometry.ts';
import type { SimState } from '../src/sim/types.ts';

/**
 * Scénarios de référence des tests, dans `tests/situations/` : ils appartiennent aux tests et
 * ne bougent pas quand le catalogue évolue. Le catalogue (`src/situations/catalogue/`) n'est
 * qu'une aide aux élèves ; les tests ne le lisent que pour vérifier qu'il respecte ses règles.
 */
const SCENARIOS = join(import.meta.dirname, 'situations');
const CATALOGUE = join(import.meta.dirname, '..', 'src', 'situations', 'catalogue');

const jsonFiles = (dir: string): string[] => readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const readJson = (dir: string, f: string): unknown => JSON.parse(readFileSync(join(dir, f), 'utf8'));

/** Scénario de référence brut (avant validation), pour tester le format. */
export function rawSituation(id: string): Record<string, any> {
  return readJson(SCENARIOS, `${id}.json`) as Record<string, any>;
}

/** Scénario de référence des tests, validé. */
export function loadSituation(id: string): Situation {
  const sit = parseSituation(rawSituation(id));
  if (sit.id !== id) throw new Error(`Scénario ${id} : identifiant ${sit.id} dans le fichier`);
  return sit;
}

/** Tous les scénarios de référence, validés. */
export function scenarios(): Situation[] {
  return jsonFiles(SCENARIOS).map((f) => parseSituation(readJson(SCENARIOS, f)));
}

/** Fichiers du dossier catalogue/, validés : seulement pour vérifier que le menu les présente tous. */
export function fichiersCatalogue(): { file: string; sit: Situation }[] {
  return jsonFiles(CATALOGUE).map((file) => ({ file, sit: parseSituation(readJson(CATALOGUE, file)) }));
}

export function start(id: string, wind?: Situation['vent']): SimState {
  return buildState(loadSituation(id), wind);
}

/** Simule pendant `seconds` secondes en vérifiant que l'état reste fini. */
export function run(s: SimState, seconds: number): void {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    tick(s, DEFAULT_PARAMS);
    const b = s.body;
    if (![b.x, b.y, b.th, b.vx, b.vy, b.w].every(Number.isFinite)) throw new Error(`Valeur non finie à l'image ${s.frame}`);
  }
}

export const deg = (rad: number): number => (rad * 180) / Math.PI;
export const bow = (s: SimState) => toWorld(s.body, [5, 0]);
export const stern = (s: SimState) => toWorld(s.body, [-5, 0]);
export const line = (s: SimState, id: string) => {
  const l = s.lines.find((x) => x.id === id);
  if (!l) throw new Error(`Aussière introuvable : ${id}`);
  return l;
};
