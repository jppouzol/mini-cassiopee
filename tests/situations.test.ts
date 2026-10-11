import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogueFiles } from './helpers.ts';
import { parseSituation, SituationError } from '../src/situations/schema.ts';
import { buildState } from '../src/situations/build.ts';

const DIR = join(import.meta.dirname, '..', 'src', 'situations', 'catalogue');
const read = (f: string) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));

test('toutes les situations du catalogue sont valides et ont un identifiant unique', () => {
  const ids = new Set<string>();
  for (const f of catalogueFiles()) {
    const sit = parseSituation(read(f));
    assert.ok(!ids.has(sit.id), `identifiant en double : ${sit.id}`);
    ids.add(sit.id);
    const s = buildState(sit);
    assert.equal(s.lines.length, sit.aussieres.length);
  }
  assert.ok(ids.size >= 4);
});

test('une aussière sans mou est tendue au départ', () => {
  const sit = parseSituation(read('01-depart-garde-avant.json'));
  const s = buildState(sit);
  const l = s.lines[0];
  assert.ok(l.len > 5 && l.len < 7, `longueur ${l.len}`);
});

test('une situation invalide est refusée avec un message lisible', () => {
  const sit = read('01-depart-garde-avant.json');
  assert.throws(() => parseSituation({ ...sit, format: 2 }), SituationError);
  assert.throws(
    () => parseSituation({ ...sit, vent: { direction: 'nord', force: 'faible' } }),
    (e: unknown) => e instanceof SituationError && /vent\.direction/.test(e.message),
  );
  assert.throws(
    () => parseSituation({ ...sit, aussieres: [{ ...sit.aussieres[0], taquet: 'bossoir' }] }),
    /taquet/,
  );
});
