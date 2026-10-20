// Bateaux en face, de l'autre côté de l'allée (#48) : sur catway, une panne parallèle au quai,
// deux catways tournés vers l'allée et quatre bateaux immobiles, étrave à la panne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSituation, rawSituation, run } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { cloneState, tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { HALF_LENGTH, HULL, hullPenetration, toLocal, toWorld } from '../src/sim/geometry.ts';
import type { SimState } from '../src/sim/types.ts';
import { Session } from '../src/session/session.ts';
import {
  EditionError, alleeEnFace, bornesDeplacement, changerBord, deplacerBateau, reglerEnFace,
} from '../src/situations/edit.ts';
import {
  ALLEES, ECART_PANNE, LARGEUR_PANNE, LONGUEUR_CATWAY, axesCatways, bittesAutresCatways, distanceEnFace, geometrieEnFace,
} from '../src/situations/quai.ts';
import { parseSituation, SituationError, type Situation } from '../src/situations/schema.ts';

const allee = (): Situation => loadSituation('catway-allee');
const sansFace = (sit: Situation): Situation => { const { enFace: _e, ...reste } = sit; return reste; };
const etroite = (sit: Situation): Situation => ({ ...sit, enFace: distanceEnFace(sit, ALLEES.etroite) });
const face = (s: SimState) => s.neighbors.filter((n) => n.id.startsWith('face-'));
const touches = (s: SimState) => face(s).some((n) => n.contacts.length > 0);
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/** Plus grande pénétration entre la coque et les bateaux d'en face (m). */
function penetrationFace(s: SimState): number {
  let m = 0;
  for (const nb of face(s)) {
    for (const p of HULL) {
      const a = hullPenetration(toLocal(nb, toWorld(s.body, p)));
      if (a) m = Math.max(m, a.depth);
      const b = hullPenetration(toLocal(s.body, toWorld(nb, p)));
      if (b) m = Math.max(m, b.depth);
    }
  }
  return m;
}

/** Sortie en marche avant sans amarre, barre à fond vers l'allée au bout de `barreApres` secondes. */
function sortie(sit: Situation, barreApres: number, barre: number, duree: number): { s: SimState; touche: boolean; pen: number } {
  const s = buildState(sit);
  s.engine = 1;
  let touche = false, pen = 0;
  for (let i = 0; i < duree * 60; i++) {
    if (i === barreApres * 60) s.rudder = barre;
    tick(s, DEFAULT_PARAMS);
    touche ||= touches(s);
    pen = Math.max(pen, penetrationFace(s));
  }
  return { s, touche, pen };
}

test('géométrie : panne au bout de l’allée, deux catways tournés vers elle, quatre bateaux étrave à la panne', () => {
  const sit = allee();
  const g = geometrieEnFace(sit);
  assert.ok(g);
  // Allée large : 20 m d'eau libre entre le bout du bateau côté chenal et les arrières d'en face.
  assert.equal(sit.enFace, sit.bateau.x + HALF_LENGTH + ALLEES.large);
  const axes = axesCatways(sit).slice().sort((a, b) => a - b);
  assert.deepEqual(g.catways.map((c) => c.x), axes, 'catways d’en face dans l’alignement de ceux du bateau');
  const yPanne = -(sit.enFace as number) - 2 * HALF_LENGTH - ECART_PANNE;
  for (const c of g.catways) {
    assert.equal(c.y, yPanne, 'pied contre la panne');
    assert.equal(c.dir, 1, 'catway tourné vers l’allée');
    assert.equal(c.length, LONGUEUR_CATWAY);
  }
  assert.equal(g.panne.y1, yPanne);
  assert.equal(g.panne.y1 - g.panne.y0, LARGEUR_PANNE);
  assert.equal(g.bateaux.length, 4);
  for (const b of g.bateaux) {
    assert.ok(near(b.th, -Math.PI / 2), 'étrave vers la panne');
    assert.ok(near(toWorld(b, [-HALF_LENGTH, 0])[1], -(sit.enFace as number), 1e-6), 'arrière sur la limite de l’allée');
    assert.ok(near(toWorld(b, [HALF_LENGTH, 0])[1], yPanne + ECART_PANNE, 1e-6), 'étrave à 1 m de la panne');
    assert.ok(b.x > g.panne.x0 && b.x < g.panne.x1, 'au-dessus de la panne');
  }
  // Un bateau de chaque côté de chaque catway : en face de la place du bateau, il y en a un dans son axe.
  const pose = buildState(sit).body;
  assert.ok(g.bateaux.some((b) => near(b.x, pose.x, 1e-6)));
  // L'état de la simulation les porte : panne, catways et bateaux d'en face, traités comme des voisins.
  const s = buildState(sit);
  assert.deepEqual(s.pannes, [g.panne]);
  assert.equal(s.catways.length, 4);
  assert.deepEqual(face(s).map((n) => n.id), ['face-1', 'face-2', 'face-3', 'face-4']);
  // Bittes des catways d'en face : dessinées estompées avec celles du second catway, jamais proposées.
  assert.equal(bittesAutresCatways(sit).length, 6);
  assert.equal(geometrieEnFace(sansFace(sit)), null);
  assert.deepEqual(buildState(sansFace(sit)).pannes, []);
});

test('géométrie : la rangée d’en face suit le bateau quand il change de bord, étrave ou arrière au quai', () => {
  const o = allee();
  for (const bout of ['arriere', 'etrave'] as const) {
    const sit: Situation = { ...o, bateau: { ...o.bateau, boutAuQuai: bout } };
    const tri = changerBord(sit, sit, 'tribord');
    assert.equal(tri.enFace, sit.enFace, 'enFace inchangé');
    const a = geometrieEnFace(sit), b = geometrieEnFace(tri);
    assert.ok(a && b);
    // Symétrique par rapport à l'axe du catway du bateau (x = 0).
    assert.deepEqual(b.catways.map((c) => c.x).sort((u, v) => u - v), a.catways.map((c) => -c.x + 0).sort((u, v) => u - v));
    assert.deepEqual(b.bateaux.map((n) => n.x).sort((u, v) => u - v), a.bateaux.map((n) => -n.x + 0).sort((u, v) => u - v));
    // Le bateau a toujours une coque en face de lui.
    const x = buildState(tri).body.x;
    assert.ok(b.bateaux.some((n) => near(n.x, x, 1e-6)), `${bout} au quai, tribord`);
  }
});

test('format : bateaux en face sur catway seulement, allée de 5 à 40 m', () => {
  const raw = rawSituation('catway-allee');
  const refuse = (r: Record<string, unknown>, motif: RegExp) =>
    assert.throws(() => parseSituation(r), (e: unknown) => e instanceof SituationError && motif.test(e.message));
  refuse({ ...raw, enFace: 11 + 4 }, /allée de 5 à 40 m/);
  refuse({ ...raw, enFace: 11 + 41 }, /allée de 5 à 40 m/);
  refuse({ ...raw, enFace: 'large' }, /allée de 5 à 40 m/);
  const longQuai = rawSituation('depart-garde-avant');
  refuse({ ...longQuai, enFace: 31 }, /qu'en perpendiculaire/);
  const enLibre = rawSituation('libre');
  refuse({ ...enLibre, enFace: 31 }, /sans objet/);
  assert.equal(parseSituation({ ...raw, enFace: 16 }).enFace, 16);
  assert.equal(parseSituation({ ...raw, enFace: undefined }).enFace, undefined);
});

test('éditeur : allée étroite ou large comptée depuis la place d’origine, retrait, refus hors du catway', () => {
  const o = sansFace(allee());
  assert.equal(alleeEnFace(o, o), null);
  const large = reglerEnFace(o, o, 'large');
  assert.equal(large.enFace, 31);
  assert.equal(alleeEnFace(large, o), 'large');
  const etr = reglerEnFace(large, o, 'etroite');
  assert.equal(etr.enFace, 26);
  assert.equal(alleeEnFace(etr, o), 'etroite');
  assert.equal(reglerEnFace(etr, o, null).enFace, undefined);
  assert.ok(!('enFace' in reglerEnFace(etr, o, null)));
  // Le bateau glissé vers le chenal : la rangée reste en place, le choix affiché aussi.
  const glisse = deplacerBateau(etr, o, o.bateau.x + 2);
  assert.equal(glisse.enFace, 26);
  assert.equal(alleeEnFace(glisse, o), 'etroite');
  // Choisi avec le bateau glissé, le choix se compte toujours depuis la place d'origine.
  assert.equal(reglerEnFace(deplacerBateau(o, o, o.bateau.x + 2), o, 'large').enFace, 31);
  // Le bord changé garde l'allée.
  assert.equal(alleeEnFace(changerBord(etr, o, 'tribord'), o), 'etroite');
  for (const id of ['depart-garde-avant', 'libre']) {
    const autre = loadSituation(id);
    assert.throws(() => reglerEnFace(autre, autre, 'large'), EditionError);
  }
});

test('éditeur : le bateau glissé vers le chenal garde au moins 5 m d’eau libre devant les bateaux d’en face', () => {
  const o = allee();
  const sit: Situation = { ...o, enFace: o.bateau.x + HALF_LENGTH + 7 };
  const [, hi] = bornesDeplacement(sit, o);
  assert.equal(hi, o.bateau.x + 2);
  assert.equal(bornesDeplacement(o, o)[1], o.bateau.x + 4, 'allée large : course habituelle');
});

test('sans contact, les bateaux en face ne changent rien à la manœuvre', () => {
  // Sortie en marche avant, barre à fond au bout de 7 s : allée large, le bateau passe sans les toucher.
  const avec = buildState(allee());
  const sans = buildState(sansFace(allee()));
  for (const s of [avec, sans]) s.engine = 1;
  for (let i = 0; i < 40 * 60; i++) {
    if (i === 7 * 60) { avec.rudder = -0.6; sans.rudder = -0.6; }
    tick(avec, DEFAULT_PARAMS);
    tick(sans, DEFAULT_PARAMS);
  }
  assert.ok(!face(avec).some((n) => n.contacts.length > 0));
  assert.deepEqual(avec.body, sans.body);
});

test('en obstacle : tout droit, la rangée d’en face arrête le bateau sans pénétration notable ; sans elle, il passe', () => {
  const { s, touche, pen } = sortie(allee(), 999, 0, 30);
  assert.ok(touche, 'contact signalé');
  assert.ok(pen < 0.15, `pénétration ${pen.toFixed(2)} m`);
  const etrave = toWorld(s.body, [HALF_LENGTH, 0])[1];
  assert.ok(etrave > -31 - 0.15, `étrave arrêtée à la limite de l’allée (${etrave.toFixed(2)})`);
  assert.ok(Math.abs(s.body.vy) < 0.05, 'le bateau est arrêté');
  const libre = sortie(sansFace(allee()), 999, 0, 30);
  assert.ok(!libre.touche);
  assert.ok(toWorld(libre.s.body, [HALF_LENGTH, 0])[1] < -40, 'sans bateaux en face, il file dans le chenal');
});

test('allée étroite ou large : le même demi-tour touche la rangée d’en face dans l’allée étroite seulement', () => {
  // Marche avant, barre à fond vers tribord au bout de 7 s : environ 16,5 m de l'allée sont balayés.
  assert.ok(!sortie(allee(), 7, -0.6, 40).touche, 'allée large : le demi-tour passe');
  const e = sortie(etroite(allee()), 7, -0.6, 40);
  assert.ok(e.touche, 'allée étroite : il faut s’y reprendre');
  assert.ok(e.pen < 0.15, `pénétration ${e.pen.toFixed(2)} m`);
});

test('la panne et les catways d’en face arrêtent le bateau comme le quai et le catway', () => {
  // Sans les bateaux d'en face, on pousse l'étrave droit sur la panne, entre les deux catways,
  // puis droit sur le bout d'un catway d'en face.
  const sit = allee();
  const g = geometrieEnFace(sit);
  assert.ok(g);
  const [a0, a1] = g.catways.map((c) => c.x).sort((u, v) => u - v);
  const cas: { nom: string; x: number; limite: number }[] = [
    { nom: 'panne', x: (a0 + a1) / 2, limite: g.panne.y1 },
    { nom: 'catway d’en face', x: a0, limite: g.panne.y1 + LONGUEUR_CATWAY },
  ];
  for (const { nom, x, limite } of cas) {
    const s = buildState(sit);
    s.neighbors = s.neighbors.filter((n) => !n.id.startsWith('face-'));
    s.body.x = x;
    s.body.y = limite + HALF_LENGTH + 1;
    s.body.th = -Math.PI / 2;
    s.engine = 1;
    let appui = false;
    let pire = Infinity;
    for (let i = 0; i < 20 * 60; i++) {
      tick(s, DEFAULT_PARAMS);
      appui ||= s.contacts.length > 0;
      pire = Math.min(pire, toWorld(s.body, [HALF_LENGTH, 0])[1]);
    }
    assert.ok(appui, `${nom} : appui signalé`);
    assert.ok(pire > limite - 0.15, `${nom} : l'étrave ne s'y enfonce pas (${(limite - pire).toFixed(2)} m)`);
  }
  // Un angle de la panne qui entre dans la coque la repousse aussi : flanc contre le coin de la panne.
  const s = buildState(sit);
  s.neighbors = [];
  s.catways = [];
  s.body.th = 0;
  s.body.x = g.panne.x1 + 0.5;
  s.body.y = g.panne.y1 + 1.5;
  s.body.vy = -0.5;
  run(s, 5);
  const coin = toLocal(s.body, [g.panne.x1, g.panne.y1]);
  const pen = hullPenetration(coin);
  assert.ok(!pen || pen.depth < 0.15, 'le coin de la panne ne traverse pas la coque');
});

test('relecture : un contact avec un bateau d’en face se rejoue à l’identique', () => {
  const ses = new Session(buildState(allee()), DEFAULT_PARAMS);
  ses.act({ type: 'engine', value: 1 });
  ses.advance(60 * 25);
  const fin = cloneState(ses.state);
  assert.ok(face(fin).some((n) => n.contacts.length > 0));
  ses.seek(331);
  ses.seek(60 * 25);
  assert.deepEqual(ses.state, fin);
});
