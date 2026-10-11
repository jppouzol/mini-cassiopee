import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseSituation, type Situation } from '../src/situations/schema.ts';
import { buildState } from '../src/situations/build.ts';
import { tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { toWorld } from '../src/sim/geometry.ts';
import type { SimState } from '../src/sim/types.ts';

const DIR = join(import.meta.dirname, '..', 'src', 'situations', 'catalogue');

export function catalogueFiles(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
}

export function loadSituation(id: string): Situation {
  for (const f of catalogueFiles()) {
    const sit = parseSituation(JSON.parse(readFileSync(join(DIR, f), 'utf8')));
    if (sit.id === id) return sit;
  }
  throw new Error(`Situation introuvable : ${id}`);
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
