import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, rawSituation, scenarios } from './helpers.ts';
import { parseSituation, SituationError } from '../src/situations/schema.ts';
import { BOLLARD_SPACING, buildState } from '../src/situations/build.ts';
import { bittesDuPort } from '../src/situations/quai.ts';
import { ECARTS_VOISIN, ecartVoisin, etraveVoisinCatway, nomDeduit } from '../src/situations/edit.ts';
import { tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';


test('toutes les situations du catalogue sont valides et ont un identifiant unique', () => {
  const ids = new Set<string>();
  for (const { sit } of catalogue()) {
    assert.ok(!ids.has(sit.id), `identifiant en double : ${sit.id}`);
    ids.add(sit.id);
    const s = buildState(sit);
    assert.equal(s.lines.length, sit.aussieres.length);
  }
});

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

test('les bittes du catalogue sont sur la rangée du quai, ou sur le catway en perpendiculaire', () => {
  for (const { file: f, sit } of catalogue()) {
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
  const sit = rawSituation('amarre-quatre-amarres');
  const [a, b] = sit.aussieres;
  assert.throws(() => parseSituation({ ...sit, aussieres: [{ ...a, bitte: 9.5 }] }), /rangée de bittes/);
  assert.throws(() => parseSituation({ ...sit, aussieres: [a, { ...b, bitte: a.bitte }] }), /déjà ce taquet/);
  // Bateau décalé de 1 m : les bittes relatives deviennent impaires.
  assert.doesNotThrow(() => parseSituation({ ...sit, bateau: { ...sit.bateau, x: 1 }, aussieres: [{ ...a, bitte: 9 }] }));
  assert.throws(() => parseSituation({ ...sit, aussieres: [{ ...a, nom: '' }] }), /nom/);
});

test('catalogue, le long du quai : les gardes sont croisées, tournées au niveau de l’autre moitié du bateau', () => {
  for (const { sit } of catalogue()) {
    if (sit.quai.type !== 'long-side') continue;
    for (const a of sit.aussieres) {
      const nom = nomDeduit(sit, a);
      // Bitte relative au milieu du bateau, positive vers l'avant ; la coque va de -5 à +5 m.
      if (nom.startsWith('Garde avant')) {
        assert.ok(a.bitte < 0 && a.bitte >= -5, `${sit.id} : garde avant tournée en ${a.bitte} m, hors de la moitié arrière`);
      } else if (nom.startsWith('Garde arrière')) {
        assert.ok(a.bitte > 0 && a.bitte <= 5, `${sit.id} : garde arrière tournée en ${a.bitte} m, hors de la moitié avant`);
      }
    }
  }
});

test('catalogue : chaque voisin correspond à un choix de l’éditeur et ne touche pas le bateau au départ', () => {
  for (const { sit } of catalogue()) {
    for (const cote of Object.keys(sit.voisins ?? {}) as (keyof NonNullable<typeof sit.voisins>)[]) {
      // L'éditeur montre ainsi le réglage du catalogue comme un choix sélectionné.
      const ecart = ecartVoisin(sit, sit, cote);
      const choix = cote === 'catway' || cote === 'large'
        ? [etraveVoisinCatway(sit)]
        : [ECARTS_VOISIN.serre, ECARTS_VOISIN.large];
      assert.ok(choix.includes(ecart as number), `${sit.id}, voisin ${cote} : écart ${ecart} hors des choix de l’éditeur`);
    }
    // Sans commande ni vent du catalogue, une seconde : aucun contact avec un voisin.
    const s = buildState(sit);
    for (let i = 0; i < 60; i++) tick(s, DEFAULT_PARAMS);
    assert.ok(s.neighbors.every((n) => n.contacts.length === 0), `${sit.id} : contact avec un voisin dès le départ`);
  }
});
