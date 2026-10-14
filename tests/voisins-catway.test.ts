// Bateaux voisins en amarrage perpendiculaire : de l'autre côté du catway du bateau,
// et côté large contre le second catway ; étrave au quai, immobiles, contact simple.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bow, loadSituation, run, stern } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { cloneState } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { HALF_BEAM, HALF_LENGTH, HULL, hullPenetration, toLocal, toWorld } from '../src/sim/geometry.ts';
import type { SimState } from '../src/sim/types.ts';
import { Session } from '../src/session/session.ts';
import {
  EditionError, ajouterAussiere, bornesDeplacement, deplacerBateau, ecartVoisin, etraveVoisinCatway, reglerVoisin,
} from '../src/situations/edit.ts';
import { DEMI_LARGEUR_CATWAY, ecartVoisinLarge } from '../src/situations/quai.ts';
import { parseSituation, type Situation } from '../src/situations/schema.ts';

const sortieArriere = (): Situation => loadSituation('catway-sortie-arriere');
const sortieAvant = (): Situation => loadSituation('catway-sortie-avant');
const lecon = (): Situation => loadSituation('catway-sortie-arriere-voisin');
const tribord = (sit: Situation): Situation => ({ ...sit, bateau: { ...sit.bateau, bordAuQuai: 'tribord' } });
const sansAmarre = (sit: Situation): Situation => ({ ...sit, aussieres: [] });
const avecVoisins = (sit: Situation, voisins: Situation['voisins']): Situation => ({ ...sit, voisins });
const avecVent = (sit: Situation, direction: Situation['vent']['direction'], force: Situation['vent']['force'] = 'soutenu'): Situation =>
  ({ ...sit, vent: { direction, force } });
const voisin = (s: SimState, id: string) => {
  const n = s.neighbors.find((x) => x.id === id);
  if (!n) throw new Error(`Voisin introuvable : ${id}`);
  return n;
};
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
const larguer = (s: SimState, ...ids: string[]) => {
  for (const l of s.lines) if (ids.length === 0 || ids.includes(l.id)) l.attached = false;
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

/** Simule image par image ; renvoie l'instant du premier contact avec un voisin (s), ou -1, et la pénétration maximale. */
function suivre(s: SimState, seconds: number, actions: (t: number) => void = () => {}): { contact: number; penetration: number } {
  let contact = -1, pen = 0;
  for (let i = 0; i < seconds * 60; i++) {
    actions(i / 60);
    run(s, 1 / 60);
    if (contact < 0 && s.neighbors.some((n) => n.contacts.length > 0)) contact = i / 60;
    pen = Math.max(pen, penetration(s));
  }
  return { contact, penetration: pen };
}

const toutes = (sit: Situation) => [sit, tribord(sit)];

test('format : voisins côté catway et côté large, étrave à une distance du quai', () => {
  const sit = lecon();
  assert.deepEqual(sit.voisins, { large: 1 });
  const json = (voisins: unknown, patch: Partial<Situation> = {}) => ({ ...sortieArriere(), ...patch, voisins });
  assert.deepEqual(parseSituation(json({ catway: 1, large: 2 })).voisins, { catway: 1, large: 2 });
  assert.throws(() => parseSituation(json({ arriere: 1 })), /côté de « voisins »/);
  assert.throws(() => parseSituation(json({ catway: 0.2 })), /du quai/, 'étrave trop près du quai');
  assert.throws(() => parseSituation(json({ large: 6 })), /du quai/, 'étrave trop loin du quai');
  // Écarté de son catway, le bateau ne laisse plus la place d'un voisin côté large ; côté catway, si.
  const loin = { aussieres: [], bateau: { ...sortieArriere().bateau, distanceQuai: 0.4 } };
  assert.throws(() => parseSituation(json({ large: 1 }, loin)), /côté large/);
  assert.deepEqual(parseSituation(json({ catway: 1 }, loin)).voisins, { catway: 1 });
  // Le long du quai, les côtés du catway sont refusés.
  assert.throws(() => parseSituation({ ...loadSituation('depart-garde-avant'), voisins: { large: 1 } }), /côté de « voisins »/);
});

test('géométrie : voisin étrave au quai, de l’autre côté du catway ou contre le second catway', () => {
  const sits = [sortieArriere(), tribord(sortieArriere()), sortieAvant(), tribord(sortieAvant())];
  for (const sit of sits.map((x) => avecVoisins(x, { catway: 1, large: 2 }))) {
    const s = buildState(sit);
    const cw = voisin(s, 'catway'), lg = voisin(s, 'large');
    for (const nb of [cw, lg]) assert.equal(nb.th, Math.PI / 2, 'toujours étrave au quai');
    // Distance de l'étrave au bord du quai.
    assert.ok(near(toWorld(cw, [HALF_LENGTH, 0])[1], -1));
    assert.ok(near(toWorld(lg, [HALF_LENGTH, 0])[1], -2));
    // Côté catway : symétrique du bateau par rapport à l'axe du catway.
    const [c1, c2] = s.catways;
    assert.ok(near(cw.x - c1.x, -(s.body.x - c1.x)));
    // Côté large : contre le second catway, au même écart que le bateau du sien.
    const ecartBateau = Math.abs(s.body.x - c1.x) - DEMI_LARGEUR_CATWAY - HALF_BEAM;
    assert.ok(near(Math.abs(lg.x - c2.x) - DEMI_LARGEUR_CATWAY - HALF_BEAM, ecartBateau));
    assert.ok(Math.sign(lg.x - c2.x) === Math.sign(s.body.x - c2.x), 'du côté du bateau');
    // Entre les deux coques côté large : 0,6 m d'eau, sans catway.
    assert.ok(near(Math.abs(lg.x - s.body.x) - 2 * HALF_BEAM, ecartVoisinLarge(sit)));
    assert.ok(near(ecartVoisinLarge(sit), 0.6));
    assert.equal(penetration(s), 0);
  }
  // Bateau arrière au quai : le voisin, étrave au quai, est tête-bêche.
  const cul = buildState(avecVoisins(sortieAvant(), { large: 1 }));
  assert.ok(near(Math.abs(voisin(cul, 'large').th - cul.body.th), Math.PI));
});

test('des voisins qu’on ne touche pas ne changent rien à la sortie en marche arrière ou avant', () => {
  for (const base of [sortieArriere(), sortieAvant()]) {
    for (const sit of toutes(base)) {
      const seul = buildState(sit);
      const entoure = buildState(avecVoisins(sit, { catway: 1, large: 1 }));
      for (const s of [seul, entoure]) {
        larguer(s);
        s.engine = base.bateau.boutAuQuai === 'etrave' ? -1 : 1;
      }
      const r = suivre(entoure, 12);
      run(seul, 12);
      assert.equal(r.contact, -1);
      assert.deepEqual(entoure.body, seul.body);
    }
  }
});

test('vent soutenu du catway, sans amarre : le voisin côté large arrête le bateau, contact signalé', () => {
  for (const sit of toutes(sansAmarre(avecVent(avecVoisins(sortieArriere(), { large: 1 }), 'catway')))) {
    const s = buildState(sit);
    const x0 = s.body.x;
    const r = suivre(s, 15);
    assert.ok(r.contact > 0 && r.contact < 6, `contact à ${r.contact} s`);
    assert.ok(r.penetration < 0.05, `pénétration ${r.penetration.toFixed(3)} m`);
    assert.ok(voisin(s, 'large').contacts.length > 0, 'le contact dure tant que le vent pousse');
    assert.ok(Math.abs(s.body.x - x0) < 0.7, 'le bateau s’arrête contre le voisin');
  }
});

test('vent soutenu du large, sans amarre : le catway arrête le bateau, le voisin côté catway n’est pas touché', () => {
  for (const sit of toutes(sansAmarre(avecVent(avecVoisins(sortieArriere(), { catway: 1 }), 'large')))) {
    const s = buildState(sit);
    const r = suivre(s, 15);
    assert.equal(r.contact, -1);
    assert.ok(s.contacts.length > 0, 'appui sur le catway');
  }
});

test('situation du catalogue : tout largué, marche arrière, le vent pousse le bateau sur le voisin', () => {
  for (const sit of toutes(lecon())) {
    const s = buildState(sit);
    const r = suivre(s, 20, (t) => {
      if (t === 0.5) larguer(s);
      if (t === 1) s.engine = -1;
    });
    assert.ok(r.contact > 0, 'le bateau touche le voisin côté large');
    assert.ok(r.penetration < 0.1);
  }
});

test('situation du catalogue : en reculant sur les gardes, l’arrière remonte au vent et le bateau sort sans toucher', () => {
  for (const sit of toutes(lecon())) {
    for (const delai of [3, 6, 10]) {
      const s = buildState(sit);
      const catway = s.catways[0].x;
      let ecartArriere = 0;
      const r = suivre(s, 30, (t) => {
        if (t === 0.5) larguer(s, 'pointe-av');
        if (t === 1.5) larguer(s, 'pointe-av-large');
        if (t === 2) s.engine = -1;
        if (t === 2 + delai) {
          // Sur la garde arrière, l'arrière s'est rapproché du catway (au vent).
          ecartArriere = Math.abs(stern(s)[0] - catway) - Math.abs(bow(s)[0] - catway);
          larguer(s, 'garde-ar');
        }
        if (t === 3 + delai) larguer(s, 'garde-av');
      });
      assert.ok(ecartArriere < -0.2, `l’arrière remonte au vent (${ecartArriere.toFixed(2)} m)`);
      assert.equal(r.contact, -1, `aucun contact avec le voisin (gardes larguées à ${delai} s)`);
      assert.ok(bow(s)[1] < -12, 'le bateau est sorti dans le chenal');
    }
  }
});

test('relecture : un contact avec un voisin sur catway se rejoue à l’identique', () => {
  // Sans amarre, vent soutenu du catway : le bateau dérive sur le voisin et reste en appui.
  const ses = new Session(buildState(sansAmarre(avecVent(lecon(), 'catway'))), DEFAULT_PARAMS);
  ses.act({ type: 'rudder', value: 0.3 });
  ses.advance(60 * 8);
  const fin = cloneState(ses.state);
  assert.ok(fin.neighbors.some((n) => n.contacts.length > 0));
  ses.seek(137);
  ses.seek(60 * 8);
  assert.deepEqual(ses.state, fin);
});

test('éditeur : placer et retirer un voisin côté catway ou côté large', () => {
  const o = sortieArriere();
  assert.equal(etraveVoisinCatway(o), 1, 'étrave du voisin à la hauteur du bout du bateau tourné vers le quai');
  let sit = reglerVoisin(o, o, 'large', etraveVoisinCatway(o));
  sit = reglerVoisin(sit, o, 'catway', etraveVoisinCatway(o));
  assert.deepEqual(sit.voisins, { large: 1, catway: 1 });
  assert.equal(ecartVoisin(sit, o, 'catway'), 1);
  assert.equal(ecartVoisin(sit, o, 'avant'), null);
  sit = reglerVoisin(reglerVoisin(sit, o, 'large', null), o, 'catway', null);
  assert.equal(sit.voisins, undefined);
  // Côtés du long du quai refusés sur catway, et inversement.
  assert.throws(() => reglerVoisin(o, o, 'arriere', 1), EditionError);
  const quai = loadSituation('depart-garde-avant');
  assert.throws(() => reglerVoisin(quai, quai, 'large', 1), /devant ou derrière/);
  // Pas de place côté large si le bateau est trop écarté de son catway.
  const loin = { ...o, bateau: { ...o.bateau, distanceQuai: 0.4 } };
  assert.throws(() => reglerVoisin(loin, loin, 'large', 1), /côté large/);
  assert.deepEqual(reglerVoisin(loin, loin, 'catway', 1).voisins, { catway: 1 });
  // Une aussière ajoutée garde les voisins.
  assert.deepEqual(ajouterAussiere(reglerVoisin(o, o, 'large', 1), 'arriere', 2.7).voisins, { large: 1 });
});

test('glisser le bateau le long du catway : les voisins restent en place et ne limitent pas la course', () => {
  for (const o of [sortieArriere(), tribord(sortieAvant())]) {
    const sit = avecVoisins(o, { catway: 1, large: 1 });
    const avant = buildState(sit).neighbors;
    assert.deepEqual(bornesDeplacement(sit, o), bornesDeplacement(o, o));
    const [lo, hi] = bornesDeplacement(sit, o);
    for (const x of [lo, hi]) {
      const glisse = deplacerBateau(sit, o, x);
      assert.deepEqual(glisse.voisins, sit.voisins);
      assert.deepEqual(buildState(glisse).neighbors, avant);
      assert.equal(penetration(buildState(glisse)), 0);
    }
  }
});
