// Choisir le bord au quai dans l'éditeur : le bateau se retourne, ses aussières passent
// en miroir, le vent et les voisins (le long du quai) restent fixes dans le port.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSituation, run } from './helpers.ts';
import { buildState, windVector } from '../src/situations/build.ts';
import {
  changerBord, deplacerBateau, ecartVoisin, nomsAffiches, reglerVoisin,
} from '../src/situations/edit.ts';
import { axesCatways, surLaRangee } from '../src/situations/quai.ts';
import type { Situation } from '../src/situations/schema.ts';
import type { SimState } from '../src/sim/types.ts';

const pres = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);
/** Angle ramené dans ]-π, π]. */
const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Simule `secondes` secondes moteur `engine`, après avoir largué les aussières si demandé. */
function manoeuvre(sit: Situation, engine: -1 | 0 | 1, secondes: number, larguer = false): SimState {
  const s = buildState(sit);
  if (larguer) for (const l of s.lines) l.attached = false;
  s.engine = engine;
  run(s, secondes);
  return s;
}

test('changer de bord vers le bord actuel ne change rien', () => {
  const sit = loadSituation('depart-garde-avant');
  assert.equal(changerBord(sit, sit, 'babord'), sit);
});

test('le long du quai : aussières en miroir, mêmes noms, manœuvre symétrique', () => {
  const sit = loadSituation('depart-garde-avant');
  const t = changerBord(sit, sit, 'tribord');
  assert.equal(t.bateau.bordAuQuai, 'tribord');
  assert.equal(t.bateau.x, sit.bateau.x);
  assert.deepEqual(t.aussieres, sit.aussieres);
  assert.deepEqual(nomsAffiches(t), nomsAffiches(sit));
  // Départ sur garde avant : la manœuvre tribord au quai est le miroir de l'originale autour du centre.
  const a = manoeuvre(sit, 1, 6);
  const b = manoeuvre(t, 1, 6);
  pres(b.body.x, 2 * sit.bateau.x - a.body.x, 1e-6);
  pres(b.body.y, a.body.y, 1e-6);
  pres(angle(b.body.th), angle(Math.PI - a.body.th), 1e-6);
});

test('le vent garde sa direction dans le port, son repère change', () => {
  const quai = { ...loadSituation('depart-garde-avant'), vent: { direction: 'quai-avant', force: 'soutenu' } } as Situation;
  const tq = changerBord(quai, quai, 'tribord');
  assert.equal(tq.vent.direction, 'quai-arriere');
  assert.equal(tq.vent.force, 'soutenu');
  assert.deepEqual(windVector(tq.vent.direction, tq), windVector(quai.vent.direction, quai));
  // « Du large » le long du quai ne change pas.
  const large = { ...quai, vent: { direction: 'large', force: 'faible' } } as Situation;
  assert.equal(changerBord(large, large, 'tribord').vent.direction, 'large');

  const catway = { ...loadSituation('catway-sortie-arriere'), vent: { direction: 'catway-chenal', force: 'faible' } } as Situation;
  const tc = changerBord(catway, catway, 'tribord');
  assert.equal(tc.vent.direction, 'large-chenal');
  const [vx, vy] = windVector(tc.vent.direction, tc);
  const [wx, wy] = windVector(catway.vent.direction, catway);
  pres(vx, wx);
  pres(vy, wy);
});

test('le long du quai : voisins en place et retournés, devant et derrière échangés', () => {
  const o = loadSituation('depart-garde-avant');
  const sit = reglerVoisin(reglerVoisin(o, o, 'avant', 1), o, 'arriere', 3);
  const t = changerBord(sit, o, 'tribord');
  assert.equal(ecartVoisin(t, o, 'avant'), 3);
  assert.equal(ecartVoisin(t, o, 'arriere'), 1);
  const avant = buildState(sit).neighbors;
  const apres = buildState(t).neighbors;
  const th = buildState(t).body.th;
  for (const v of avant) {
    const meme = apres.find((n) => Math.abs(n.x - v.x) < 1e-6 && Math.abs(n.y - v.y) < 1e-6);
    assert.ok(meme, `voisin en ${v.x} déplacé`);
    pres(meme.th, th);
  }
});

test('le long du quai, sur un demi-mètre : décalage de 1 m vers l’origine, aussières sur la rangée', () => {
  const o = loadSituation('amarre-quatre-amarres');
  const sit = deplacerBateau(o, o, o.bateau.x + 0.5);
  const t = changerBord(sit, o, 'tribord');
  assert.equal(t.bateau.x, o.bateau.x - 0.5);
  assert.ok(t.aussieres.every((a) => surLaRangee(t, a)));
  assert.deepEqual(t.aussieres, sit.aussieres);
  assert.deepEqual(nomsAffiches(t), nomsAffiches(sit));
  // Mêmes longueurs : chaque aussière est le miroir exact de l'originale.
  const la = buildState(sit).lines, lb = buildState(t).lines;
  la.forEach((l, i) => pres(lb[i].len, l.len, 1e-9));
  // L'aller-retour rend la situation de départ.
  assert.deepEqual(changerBord(t, o, 'babord'), sit);
});

test('sans aussière, le bateau se retourne sur place même sur un demi-mètre', () => {
  const o = { ...loadSituation('depart-garde-avant'), aussieres: [] };
  const sit = deplacerBateau(o, o, o.bateau.x - 1.5);
  assert.equal(changerBord(sit, o, 'tribord').bateau.x, sit.bateau.x);
});

test('aller-retour sur un mètre entier : la situation est inchangée', () => {
  const o = loadSituation('depart-garde-arriere');
  const sit = reglerVoisin(deplacerBateau(o, o, o.bateau.x + 2), o, 'avant', 3);
  assert.deepEqual(changerBord(changerBord(sit, o, 'tribord'), o, 'babord'), sit);
});

test('sur catway : le bateau passe de l’autre côté du catway, voisins et second catway le suivent', () => {
  const o = loadSituation('catway-sortie-arriere');
  const sit = reglerVoisin(reglerVoisin(o, o, 'catway', 1), o, 'large', 1);
  const t = changerBord(sit, o, 'tribord');
  assert.deepEqual(t.aussieres, sit.aussieres);
  assert.deepEqual(t.voisins, sit.voisins);
  // Même rôle ; chaque pointe change de bord avec son taquet.
  assert.deepEqual(nomsAffiches(sit), ['Pointe avant bâbord', 'Pointe avant tribord', 'Garde avant', 'Garde arrière']);
  assert.deepEqual(nomsAffiches(t), ['Pointe avant tribord', 'Pointe avant bâbord', 'Garde avant', 'Garde arrière']);
  const a = buildState(sit), b = buildState(t);
  pres(b.body.x, -a.body.x);
  pres(b.body.y, a.body.y);
  assert.deepEqual(axesCatways(t), axesCatways(sit).map((x) => -x + 0));
  for (const v of a.neighbors) {
    const n = b.neighbors.find((m) => m.id === v.id);
    assert.ok(n);
    pres(n.x, -v.x);
    pres(n.y, v.y);
  }
  // Sortie en marche arrière, aussières larguées : trajectoire miroir autour du catway.
  const ra = manoeuvre(sit, -1, 8, true);
  const rb = manoeuvre(t, -1, 8, true);
  pres(rb.body.x, -ra.body.x, 1e-6);
  pres(rb.body.y, ra.body.y, 1e-6);
});
