// Bateaux voisins : obstacles immobiles, contact simple comme le quai, réglage dans l'éditeur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bow, deg, line, loadSituation, run, stern } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { cloneState, tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { HULL, hullPenetration, toLocal, toWorld } from '../src/sim/geometry.ts';
import type { SimState } from '../src/sim/types.ts';
import { Session } from '../src/session/session.ts';
import {
  ECARTS_VOISIN, EditionError, ajouterAussiere, bornesDeplacement, deplacerBateau, ecartVoisin, reglerVoisin,
} from '../src/situations/edit.ts';
import { xVoisin } from '../src/situations/quai.ts';
import { parseSituation, type Situation } from '../src/situations/schema.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const garde = (): Situation => loadSituation('depart-garde-avant');
const avecVoisins = (sit: Situation, avant?: number, arriere?: number): Situation => {
  const voisins: Situation['voisins'] = {};
  if (avant !== undefined) voisins.avant = avant;
  if (arriere !== undefined) voisins.arriere = arriere;
  return { ...sit, voisins };
};
const sansAmarre = (sit: Situation): Situation => ({ ...sit, aussieres: [] });
const tribord = (sit: Situation): Situation => ({ ...sit, bateau: { ...sit.bateau, bordAuQuai: 'tribord' } });
const voisin = (s: SimState, id: string) => {
  const n = s.neighbors.find((x) => x.id === id);
  if (!n) throw new Error(`Voisin introuvable : ${id}`);
  return n;
};

/** Plus grande pénétration entre la coque et les voisins (m). */
function penetration(s: SimState): number {
  let m = 0;
  for (const nb of s.neighbors) {
    for (const p of HULL) {
      const a = hullPenetration(toLocal(nb, toWorld(s.body, p)));
      const b = hullPenetration(toLocal(s.body, toWorld(nb, p)));
      m = Math.max(m, a?.depth ?? 0, b?.depth ?? 0);
    }
  }
  return m;
}

test('format : voisins lus, côté ou écart invalides refusés', () => {
  const sit = loadSituation('depart-garde-avant-voisins');
  assert.deepEqual(sit.voisins, { avant: 1, arriere: 1 });
  const json = (voisins: unknown) => ({ ...garde(), voisins });
  assert.throws(() => parseSituation(json({ babord: 1 })), /côté/);
  assert.throws(() => parseSituation(json({ avant: 0.2 })), /écart/);
  assert.throws(() => parseSituation(json([1])), /objet/);
  assert.equal(parseSituation(json({})).voisins, undefined, 'un objet vide ne déclare aucun voisin');
});

test('les voisins sont placés devant et derrière, même cap et même écart au quai', () => {
  for (const sit of [avecVoisins(garde(), 1, 3), tribord(avecVoisins(garde(), 1, 3))]) {
    const s = buildState(sit);
    const av = voisin(s, 'avant'), ar = voisin(s, 'arriere');
    assert.equal(av.th, s.body.th);
    assert.equal(av.y, s.body.y);
    // Écart mesuré le long du quai entre les extrémités des coques.
    assert.ok(Math.abs(Math.abs(toWorld(av, [-5, 0])[0] - bow(s)[0]) - 1) < 1e-9);
    assert.ok(Math.abs(Math.abs(toWorld(ar, [5, 0])[0] - stern(s)[0]) - 3) < 1e-9);
    assert.equal(penetration(s), 0);
  }
});

test('des voisins qu’on ne touche pas ne changent rien à la manœuvre', () => {
  const seul = buildState(garde());
  const entoure = buildState(avecVoisins(garde(), ECARTS_VOISIN.large, ECARTS_VOISIN.large));
  for (const s of [seul, entoure]) { s.engine = 1; s.rudder = rad(25); }
  run(seul, 8);
  run(entoure, 8);
  assert.deepEqual(entoure.body, seul.body);
  assert.ok(entoure.neighbors.every((n) => n.contacts.length === 0));
});

test('marche avant sans amarre : le voisin de devant arrête le bateau et le contact est signalé', () => {
  const s = buildState(sansAmarre(avecVoisins(garde(), 1, 1)));
  s.engine = 1;
  run(s, 8);
  assert.ok(voisin(s, 'avant').contacts.length > 0, 'contact avec le voisin de devant');
  assert.equal(voisin(s, 'arriere').contacts.length, 0);
  assert.ok(Math.abs(s.body.x - 1) < 0.05, `le bateau s’arrête contre le voisin (x = ${s.body.x.toFixed(2)})`);
  assert.ok(penetration(s) < 0.02, `pénétration ${penetration(s).toFixed(3)} m`);
  assert.ok(Math.hypot(s.body.vx, s.body.vy) < 0.01, 'le bateau est immobile');
});

test('marche arrière sans amarre : le voisin de derrière arrête le bateau', () => {
  const s = buildState(sansAmarre(avecVoisins(garde(), 1, 1)));
  s.engine = -1;
  run(s, 8);
  assert.ok(voisin(s, 'arriere').contacts.length > 0);
  assert.equal(voisin(s, 'avant').contacts.length, 0);
  assert.ok(Math.abs(s.body.x + 1) < 0.05, `x = ${s.body.x.toFixed(2)}`);
  assert.ok(penetration(s) < 0.02);
});

test('sans garde, barre vers le large : l’arrière frotte le quai et l’étrave touche le voisin', () => {
  const s = buildState(sansAmarre(loadSituation('depart-garde-avant-voisins')));
  s.engine = 1;
  s.rudder = rad(-30);
  run(s, 8);
  assert.ok(voisin(s, 'avant').contacts.length > 0, 'contact avec le voisin de devant');
  assert.ok(s.contacts.length > 0, 'l’arrière appuie sur le quai');
  assert.ok(deg(s.body.th) > -10, `l’étrave n’a pas débordé (cap ${deg(s.body.th).toFixed(1)}°)`);
});

test('le voisin sert de point d’appui : étrave contre lui, la barre fait pivoter le bateau autour de l’étrave', () => {
  const s = buildState(sansAmarre(avecVoisins(garde(), 1)));
  s.engine = 1;
  run(s, 4);
  s.rudder = rad(25);
  run(s, 6);
  assert.ok(voisin(s, 'avant').contacts.length > 0, 'l’étrave reste en appui sur le voisin');
  assert.ok(deg(s.body.th) > 8, `cap ${deg(s.body.th).toFixed(1)}°`);
  assert.ok(s.pivot !== null && s.pivot > 4, `pivot à l’étrave (${s.pivot})`);
  assert.ok(penetration(s) < 0.02);
});

test('départ sur garde avant entre deux voisins : le bateau sort sans les toucher', () => {
  const s = buildState(loadSituation('depart-garde-avant-voisins'));
  s.engine = 1;
  s.rudder = rad(25);
  let touche = false;
  for (let i = 0; i < 60 * 10; i++) { tick(s, DEFAULT_PARAMS); touche ||= s.neighbors.some((n) => n.contacts.length > 0); }
  assert.ok(deg(s.body.th) > 20, `phase 1 : l’arrière a décollé (cap ${deg(s.body.th).toFixed(1)}°)`);
  s.engine = -1;
  s.rudder = 0;
  line(s, 'garde-av').attached = false;
  for (let i = 0; i < 60 * 8; i++) { tick(s, DEFAULT_PARAMS); touche ||= s.neighbors.some((n) => n.contacts.length > 0); }
  assert.ok(!touche, 'aucun contact avec un voisin');
  assert.ok(s.body.y < -5, `le bateau s’est dégagé (y = ${s.body.y.toFixed(2)})`);
});

test('tribord au quai, le contact avec le voisin est le symétrique', () => {
  const b = buildState(sansAmarre(avecVoisins(garde(), 1, 1)));
  const t = buildState(tribord(sansAmarre(avecVoisins(garde(), 1, 1))));
  b.engine = 1; t.engine = 1;
  // Barre vers le large : bâbord au quai, le large est à tribord, et inversement.
  b.rudder = rad(-20); t.rudder = rad(20);
  run(b, 8);
  run(t, 8);
  assert.ok(Math.abs(t.body.x + b.body.x) < 0.02, `x ${t.body.x} / ${b.body.x}`);
  assert.ok(Math.abs(t.body.y - b.body.y) < 0.02);
  assert.ok(Math.abs(t.body.th - (Math.PI - b.body.th)) < 0.01);
  assert.ok(voisin(b, 'avant').contacts.length > 0 && voisin(t, 'avant').contacts.length > 0);
});

test('relecture : un contact avec un voisin se rejoue à l’identique', () => {
  const ses = new Session(buildState(sansAmarre(loadSituation('depart-garde-avant-voisins'))), DEFAULT_PARAMS);
  ses.act({ type: 'engine', value: 1 });
  ses.act({ type: 'rudder', value: rad(-30) });
  ses.advance(60 * 6);
  const fin = cloneState(ses.state);
  assert.ok(fin.neighbors.some((n) => n.contacts.length > 0));
  ses.seek(137);
  ses.seek(60 * 6);
  assert.deepEqual(ses.state, fin);
});

test('éditeur : placer, changer et retirer un voisin', () => {
  const o = garde();
  let sit = reglerVoisin(o, o, 'avant', ECARTS_VOISIN.serre);
  assert.deepEqual(sit.voisins, { avant: 1 });
  sit = reglerVoisin(sit, o, 'arriere', ECARTS_VOISIN.large);
  assert.deepEqual(sit.voisins, { avant: 1, arriere: 3 });
  assert.equal(ecartVoisin(sit, o, 'arriere'), 3);
  sit = reglerVoisin(sit, o, 'avant', null);
  sit = reglerVoisin(sit, o, 'arriere', null);
  assert.equal(sit.voisins, undefined, 'plus de champ voisins sans voisin');
  // Une aussière ajoutée garde les voisins.
  sit = ajouterAussiere(reglerVoisin(o, o, 'avant', 1), 'arriere', -2);
  assert.deepEqual(sit.voisins, { avant: 1 });
});

test('glisser le bateau : les voisins restent en place et le bateau ne s’en approche pas à moins de 0,5 m', () => {
  for (const o of [avecVoisins(garde(), 1, 3), tribord(avecVoisins(garde(), 1, 3))]) {
    const xAv = xVoisin(o, 'avant', 1), xAr = xVoisin(o, 'arriere', 3);
    const sens = o.bateau.bordAuQuai === 'babord' ? 1 : -1;
    // Vers le voisin de devant, à 1 m : un seul pas possible.
    const versAvant = deplacerBateau(o, o, o.bateau.x + sens * 4);
    assert.equal(versAvant.bateau.x, sens * 0.5);
    assert.equal(versAvant.voisins?.avant, 0.5);
    assert.equal(versAvant.voisins?.arriere, 3.5);
    assert.equal(xVoisin(versAvant, 'avant', versAvant.voisins!.avant!), xAv);
    assert.equal(xVoisin(versAvant, 'arriere', versAvant.voisins!.arriere!), xAr);
    // L'écart réglé, compté depuis la place d'origine, ne change pas.
    assert.equal(ecartVoisin(versAvant, o, 'avant'), 1);
    assert.equal(ecartVoisin(versAvant, o, 'arriere'), 3);
    // Vers le voisin de derrière, à 3 m : 2,5 m au plus.
    const versArriere = deplacerBateau(o, o, o.bateau.x - sens * 4);
    assert.equal(versArriere.bateau.x, -sens * 2.5);
    assert.equal(versArriere.voisins?.arriere, 0.5);
    assert.deepEqual(bornesDeplacement(o, o), sens === 1 ? [-2.5, 0.5] : [-0.5, 2.5]);
    assert.equal(penetration(buildState(versArriere)), 0);
  }
});

test('éditeur : pas de voisin là où le bateau déplacé n’a plus la place', () => {
  const o = garde();
  const avance = deplacerBateau(o, o, 3);
  assert.throws(() => reglerVoisin(avance, o, 'avant', ECARTS_VOISIN.serre), EditionError);
  // Le voisin large devant reste possible, à 0,5 m du bateau avancé de 2,5 m.
  const sit = reglerVoisin(deplacerBateau(o, o, 2.5), o, 'avant', ECARTS_VOISIN.large);
  assert.equal(sit.voisins?.avant, 0.5);
  // Derrière, la place s'est agrandie.
  assert.equal(reglerVoisin(avance, o, 'arriere', ECARTS_VOISIN.serre).voisins?.arriere, 4);
});
