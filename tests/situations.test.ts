import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rawSituation, scenarios } from './helpers.ts';
import { parseSituation, SituationError } from '../src/situations/schema.ts';
import { buildState } from '../src/situations/build.ts';

test('les scénarios de référence des tests sont valides et ont un identifiant unique', () => {
  const ids = new Set<string>();
  for (const sit of scenarios()) {
    assert.ok(!ids.has(sit.id), `identifiant en double : ${sit.id}`);
    ids.add(sit.id);
    assert.equal(buildState(sit).lines.length, sit.aussieres.length);
  }
});

test('une aussière sans mou est tendue au départ', () => {
  const sit = parseSituation(rawSituation('depart-garde-avant'));
  const s = buildState(sit);
  const l = s.lines[0];
  // Garde avant croisée, de l'étrave à la bitte 4 m en arrière du milieu : environ 8,7 m, sans mou.
  assert.ok(l.len > 8 && l.len < 9.5, `longueur ${l.len}`);
});

test('une situation invalide est refusée avec un message lisible', () => {
  const sit = rawSituation('depart-garde-avant');
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

test('une bitte hors rangée ou un doublon taquet–bitte sont refusés', () => {
  const sit = rawSituation('amarre-quatre-amarres');
  const [a, b] = sit.aussieres;
  assert.throws(() => parseSituation({ ...sit, aussieres: [{ ...a, bitte: 9.5 }] }), /rangée de bittes/);
  assert.throws(() => parseSituation({ ...sit, aussieres: [a, { ...b, bitte: a.bitte }] }), /déjà ce taquet/);
  // Bateau décalé de 1 m : les bittes relatives deviennent impaires.
  assert.doesNotThrow(() => parseSituation({ ...sit, bateau: { ...sit.bateau, x: 1 }, aussieres: [{ ...a, bitte: 9 }] }));
  assert.throws(() => parseSituation({ ...sit, aussieres: [{ ...a, nom: '' }] }), /nom/);
});

