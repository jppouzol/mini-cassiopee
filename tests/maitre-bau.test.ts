// Taquets au maître-bau (#16) : nom déduit, éditeur, changement de bord et garde au maître-bau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bow, deg, line, loadSituation, run, start, stern } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { ajouterAussiere, changerBord, nomDeduit, nomsAffiches, taquetsProposes } from '../src/situations/edit.ts';
import type { Situation } from '../src/situations/schema.ts';

const BARRE_AU_LARGE = (-30 * Math.PI) / 180;
const vide = (id: string): Situation => ({ ...loadSituation(id), aussieres: [] });

test('maître-bau : deux taquets proposés, au milieu de la coque, un sur chaque bord', () => {
  for (const bord of ['babord', 'tribord'] as const) {
    const sit = { ...vide('depart-garde-avant'), bateau: { ...vide('depart-garde-avant').bateau, bordAuQuai: bord } };
    const quai = bord === 'babord' ? 1 : -1;
    const t = Object.fromEntries(taquetsProposes(sit).map((c) => [c.name, c.pos]));
    assert.equal(t['maitre-bau'][0], 0);
    assert.equal(t['maitre-bau-large'][0], 0);
    assert.ok(t['maitre-bau'][1] * quai > 1, 'côté quai');
    assert.ok(t['maitre-bau-large'][1] * quai < -1, 'côté large');
  }
});

test('nom au maître-bau : traversier, garde avant et garde arrière selon le sens', () => {
  const sit = vide('depart-garde-avant');
  const nom = (taquet: 'maitre-bau' | 'maitre-bau-large', bitte: number) => nomDeduit(sit, { taquet, bitte });
  assert.equal(nom('maitre-bau', 0), 'Traversier au maître-bau');
  assert.equal(nom('maitre-bau', -4), 'Garde avant au maître-bau');
  assert.equal(nom('maitre-bau', 4), 'Garde arrière au maître-bau');
  assert.equal(nom('maitre-bau-large', -4), 'Garde avant au maître-bau');
  assert.equal(nom('maitre-bau-large', 4), 'Garde arrière au maître-bau');
  // Même nom tribord au quai : le calcul se fait en repère bateau.
  const tribord = { ...sit, bateau: { ...sit.bateau, bordAuQuai: 'tribord' as const } };
  assert.equal(nomDeduit(tribord, { taquet: 'maitre-bau', bitte: -4 }), 'Garde avant au maître-bau');
  assert.equal(nomDeduit(tribord, { taquet: 'maitre-bau', bitte: 4 }), 'Garde arrière au maître-bau');
});

test('nom au maître-bau : deux gardes de même nom départagées par le bord', () => {
  const sit = vide('depart-garde-avant');
  const deux = ajouterAussiere(ajouterAussiere(sit, 'maitre-bau', -4), 'maitre-bau-large', -6);
  assert.deepEqual(nomsAffiches(deux), ['Garde avant au maître-bau bâbord', 'Garde avant au maître-bau tribord']);
  const meme = ajouterAussiere(deux, 'maitre-bau', -6);
  assert.deepEqual(nomsAffiches(meme), ['Garde avant au maître-bau 1', 'Garde avant au maître-bau 2', 'Garde avant au maître-bau 3']);
});

test('nom au maître-bau sur catway : garde vers le quai ou vers le chenal, des deux côtés du catway', () => {
  const sit = vide('catway-sortie-arriere');
  // Étrave au quai : une bitte du catway côté quai est en avant du maître-bau.
  const noms = (s: Situation) => [nomDeduit(s, { taquet: 'maitre-bau', bitte: 2.7 }), nomDeduit(s, { taquet: 'maitre-bau', bitte: 2, sur: 'quai' })];
  assert.equal(noms(sit)[0], 'Garde arrière au maître-bau');
  assert.match(noms(sit)[1], /au maître-bau$/);
  const autre = changerBord(sit, sit, 'tribord');
  assert.equal(nomDeduit(autre, { taquet: 'maitre-bau', bitte: 2.7 }), 'Garde arrière au maître-bau');
});

test('changement de bord : l’aussière au maître-bau passe en miroir et garde son nom', () => {
  const sit = loadSituation('garde-maitre-bau');
  const t = changerBord(sit, sit, 'tribord');
  assert.equal(t.aussieres[0].taquet, 'maitre-bau');
  assert.equal(t.aussieres[0].bitte, -4);
  assert.deepEqual(nomsAffiches(t), ['Garde avant au maître-bau']);
  assert.deepEqual(changerBord(t, sit, 'babord'), sit);
});

test('garde avant au maître-bau, moteur avant : le bateau pivote bien moins qu’avec une garde à l’étrave', () => {
  const mb = start('garde-maitre-bau');
  mb.engine = 1;
  run(mb, 15);
  const etrave = start('depart-garde-avant');
  etrave.engine = 1;
  run(etrave, 15);
  assert.ok(deg(mb.body.th) < deg(etrave.body.th) * 0.75, `${deg(mb.body.th).toFixed(1)}° contre ${deg(etrave.body.th).toFixed(1)}°`);
  assert.ok(line(mb, 'garde-mb').tension > 500, 'la garde travaille');
  assert.ok(Math.abs(mb.body.x) < 1, 'la garde retient le bateau');
});

test('garde avant au maître-bau, moteur avant et barre au large : le bateau reste parallèle au quai', () => {
  const s = start('garde-maitre-bau');
  s.engine = 1;
  s.rudder = BARRE_AU_LARGE;
  // Le bateau s'allonge contre le quai en une vingtaine de secondes, puis ne bouge plus.
  run(s, 30);
  assert.ok(Math.abs(deg(s.body.th)) < 2, `cap ${deg(s.body.th).toFixed(1)}°`);
  assert.ok(bow(s)[1] > -2.2 && stern(s)[1] > -2.2, 'étrave et arrière restent au quai');
  assert.ok(line(s, 'garde-mb').tension > 500, 'la garde travaille');
  assert.ok(Math.abs(s.body.x) < 1, 'la garde retient le bateau');
  assert.ok(Math.abs(s.body.w) < 1e-3, 'pas d’oscillation');
  assert.ok(s.contacts.length >= 2, 'en appui sur le quai sur toute sa longueur');
});

test('garde avant au maître-bau, tribord au quai : manœuvre symétrique', () => {
  const sit = loadSituation('garde-maitre-bau');
  const a = buildState(sit);
  const b = buildState(changerBord(sit, sit, 'tribord'));
  a.engine = 1; b.engine = 1;
  a.rudder = BARRE_AU_LARGE / 2; b.rudder = -BARRE_AU_LARGE / 2;
  run(a, 8); run(b, 8);
  // Retourné sur place, le bateau tribord au quai a l'étrave vers -x : on compare au miroir.
  assert.ok(Math.abs(a.body.y - b.body.y) < 1e-6, `y ${a.body.y} / ${b.body.y}`);
  assert.ok(Math.abs(a.body.x + b.body.x) < 1e-6, `x ${a.body.x} / ${b.body.x}`);
});
