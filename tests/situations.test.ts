import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogueFiles } from './helpers.ts';
import { parseSituation, SituationError } from '../src/situations/schema.ts';
import { BOLLARD_SPACING, buildState } from '../src/situations/build.ts';
import { bittesDuPort } from '../src/situations/quai.ts';

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
  assert.ok(l.len > 4 && l.len < 7, `longueur ${l.len}`);
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

test('les bittes du catalogue sont sur la rangée du quai, ou sur le catway en perpendiculaire', () => {
  for (const f of catalogueFiles()) {
    const sit = parseSituation(read(f));
    const port = bittesDuPort(sit).map((p) => p.join(','));
    for (const l of buildState(sit).lines) {
      assert.ok(port.includes(l.bollard.join(',')), `${f} : bitte en ${l.bollard}`);
      if (sit.quai.type === 'long-side') {
        const k = l.bollard[0] / BOLLARD_SPACING;
        assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `${f} : bitte à x = ${l.bollard[0]}`);
      }
    }
  }
});

test('une bitte hors rangée ou un doublon taquet–bitte sont refusés', () => {
  const sit = read('03-amarre-quatre-amarres.json');
  const [a, b] = sit.aussieres;
  assert.throws(() => parseSituation({ ...sit, aussieres: [{ ...a, bitte: 9.5 }] }), /rangée de bittes/);
  assert.throws(() => parseSituation({ ...sit, aussieres: [a, { ...b, bitte: a.bitte }] }), /déjà ce taquet/);
  // Bateau décalé de 1 m : les bittes relatives deviennent impaires.
  assert.doesNotThrow(() => parseSituation({ ...sit, bateau: { ...sit.bateau, x: 1 }, aussieres: [{ ...a, bitte: 9 }] }));
  assert.throws(() => parseSituation({ ...sit, aussieres: [{ ...a, nom: '' }] }), /nom/);
});
