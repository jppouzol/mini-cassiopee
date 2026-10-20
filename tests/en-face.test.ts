// Bateaux en face, de l'autre côté de l'allée (#48) : sur catway, une panne parallèle au quai,
// deux catways tournés vers l'allée et quatre bateaux immobiles, étrave à la panne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSituation, rawSituation } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { cloneState, tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { HALF_LENGTH, HULL, hullPenetration, toLocal, toWorld } from '../src/sim/geometry.ts';
import type { SimState } from '../src/sim/types.ts';
import { bateauxEnFace, catwaysEnFace } from '../src/sim/enface.ts';
import { camera, hauteurVue } from '../src/render/renderer.ts';
import { HAUTEUR_VUE, bornerCadrage, echelleDefaut } from '../src/render/cadrage.ts';
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
/** Bateaux d'en face assez proches du bateau pour le toucher. */
const proches = (s: SimState) => (s.enFace ? bateauxEnFace(s.enFace, s.body.x - 12, s.body.x + 12) : []);
const touches = (s: SimState) => (s.enFace?.contacts.length ?? 0) > 0;
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/** Plus grande pénétration entre la coque et les bateaux d'en face (m). */
function penetrationFace(s: SimState): number {
  let m = 0;
  for (const nb of proches(s)) {
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

test('géométrie : rangée sans fin, panne au bout de l’allée, catways tournés vers elle, bateaux étrave à la panne', () => {
  const sit = allee();
  const g = geometrieEnFace(sit);
  assert.ok(g);
  const r = { ...g, contacts: [] };
  // Allée large : 20 m d'eau libre entre le bout du bateau côté chenal et les arrières d'en face.
  assert.equal(sit.enFace, sit.bateau.x + HALF_LENGTH + ALLEES.large);
  // Catways d'en face dans l'alignement de ceux du bateau, et ainsi de suite tous les 9 m.
  const cw = catwaysEnFace(r, -50, 50);
  for (const x of axesCatways(sit)) assert.ok(cw.some((c) => near(c.x, x)), `catway d’en face en face de ${x}`);
  assert.equal(cw.length, 11);
  const yPanne = -(sit.enFace as number) - 2 * HALF_LENGTH - ECART_PANNE;
  assert.equal(g.yPanne, yPanne);
  assert.equal(g.largeurPanne, LARGEUR_PANNE);
  for (const c of cw) {
    assert.equal(c.y, yPanne, 'pied contre la panne');
    assert.equal(c.dir, 1, 'catway tourné vers l’allée');
    assert.equal(c.length, LONGUEUR_CATWAY);
  }
  // Un bateau de chaque côté de chaque catway : deux par intervalle de 9 m, à 0,6 m l'un de l'autre.
  const bateaux = bateauxEnFace(r, -50, 50);
  assert.equal(bateaux.length, 22);
  for (const b of bateaux) {
    assert.ok(near(b.th, -Math.PI / 2), 'étrave vers la panne');
    assert.ok(near(toWorld(b, [-HALF_LENGTH, 0])[1], -(sit.enFace as number), 1e-6), 'arrière sur la limite de l’allée');
    assert.ok(near(toWorld(b, [HALF_LENGTH, 0])[1], yPanne + ECART_PANNE, 1e-6), 'étrave à 1 m de la panne');
  }
  const xs = bateaux.map((b) => b.x).sort((u, v) => u - v);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] > 2 * 1.7, 'les coques ne se chevauchent pas');
  // Le bateau a une coque en face de lui.
  const s = buildState(sit);
  assert.ok(bateaux.some((b) => near(b.x, s.body.x, 1e-6)));
  // L'état porte la rangée ; les voisins restent ceux du bateau.
  assert.deepEqual(s.enFace, r);
  assert.deepEqual(s.neighbors.map((n) => n.id), ['catway', 'large']);
  assert.equal(s.catways.length, 2);
  // Bittes des catways d'en face : dessinées estompées avec celles du second catway, jamais proposées.
  assert.ok(bittesAutresCatways(sit).length > 2 + 2 * 40);
  assert.equal(geometrieEnFace(sansFace(sit)), null);
  assert.equal(buildState(sansFace(sit)).enFace, null);
});

test('géométrie : la rangée d’en face reste en face du bateau quand il change de bord, étrave ou arrière au quai', () => {
  const o = allee();
  for (const bout of ['arriere', 'etrave'] as const) {
    for (const bord of ['babord', 'tribord'] as const) {
      const sit = changerBord({ ...o, bateau: { ...o.bateau, boutAuQuai: bout } }, o, bord);
      assert.equal(sit.enFace, o.enFace, 'enFace inchangé');
      const s = buildState(sit);
      assert.ok(s.enFace);
      assert.ok(bateauxEnFace(s.enFace, -20, 20).some((n) => near(n.x, s.body.x, 1e-6)), `${bout} au quai, ${bord}`);
      for (const x of axesCatways(sit)) assert.ok(catwaysEnFace(s.enFace, -20, 20).some((c) => near(c.x, x)));
    }
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
  assert.ok(!touches(avec));
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

/** Pousse l'étrave droit vers le bas, depuis 1 m au-dessus de `limite`, et mesure l'appui. */
function pousser(s: SimState, x: number, limite: number): { appui: boolean; enfoncement: number } {
  s.body.x = x;
  s.body.y = limite + HALF_LENGTH + 1;
  s.body.th = -Math.PI / 2;
  s.engine = 1;
  let appui = false, pire = Infinity;
  for (let i = 0; i < 20 * 60; i++) {
    tick(s, DEFAULT_PARAMS);
    appui ||= s.contacts.length > 0;
    pire = Math.min(pire, toWorld(s.body, [HALF_LENGTH, 0])[1]);
  }
  return { appui, enfoncement: limite - pire };
}

test('la panne et les catways d’en face arrêtent le bateau comme le quai et le catway', () => {
  // On écarte de la rangée les éléments qui gêneraient : bateaux très loin des catways (recul),
  // puis catways très espacés (pas), pour atteindre le bout d'un catway, puis la panne.
  const base = buildState(allee());
  const r = base.enFace;
  assert.ok(r);
  const catway = buildState(allee());
  catway.enFace = { ...r, recul: 500 };
  const c = pousser(catway, 0, r.yPanne + r.longueurCatway);
  assert.ok(c.appui, 'catway d’en face : appui signalé');
  assert.ok(c.enfoncement < 0.15, `catway d’en face : l'étrave ne s'y enfonce pas (${c.enfoncement.toFixed(2)} m)`);
  const panne = buildState(allee());
  panne.enFace = { ...r, recul: 300, pas: 1000, x0: 500 };
  const q = pousser(panne, 0, r.yPanne);
  assert.ok(q.appui, 'panne : appui signalé');
  assert.ok(q.enfoncement < 0.15, `panne : l'étrave ne s'y enfonce pas (${q.enfoncement.toFixed(2)} m)`);
});

test('rangée sans fin : loin le long de l’allée, les bateaux d’en face arrêtent encore le bateau', () => {
  const s = buildState(allee());
  const r = s.enFace;
  assert.ok(r);
  // 150 m plus loin, sur l'axe d'un bateau d'en face.
  const loin = bateauxEnFace(r, 150, 160)[0];
  const { appui } = pousser(s, loin.x, -(allee().enFace as number));
  assert.ok(touches(s) || appui);
  assert.ok(s.enFace?.contacts.some((c) => near(c.x, loin.x, 1e-6)), 'contact signalé sur ce bateau-là');
  assert.ok(penetrationFace(s) < 0.15);
});

test('relecture : un contact avec un bateau d’en face se rejoue à l’identique', () => {
  const ses = new Session(buildState(allee()), DEFAULT_PARAMS);
  ses.act({ type: 'engine', value: 1 });
  ses.advance(60 * 25);
  const fin = cloneState(ses.state);
  assert.ok(touches(fin));
  ses.seek(331);
  ses.seek(60 * 25);
  assert.deepEqual(ses.state, fin);
});

test('cadrage par défaut : sur PC, l’allée entière jusqu’à la panne d’en face ; sur téléphone, inchangé', () => {
  const s = buildState(allee());
  const r = s.enFace;
  assert.ok(r);
  const sans = buildState(sansFace(allee()));
  // PC : quai en haut, panne d'en face entière en bas de la vue.
  const pc = camera(s, 910, 720);
  assert.ok(pc.Y(0) >= 0 && pc.Y(r.yPanne - r.largeurPanne) <= 720 - 80 + 1e-6, 'quai et panne dans la vue, le bas laissé à l’échelle et au vent');
  assert.ok(hauteurVue(s, 910, 720) > hauteurVue(sans, 910, 720));
  assert.equal(hauteurVue(sans, 910, 720), HAUTEUR_VUE);
  // Téléphone : même cadrage que sans bateaux en face ; on dézoome pour voir l'allée.
  assert.equal(camera(s, 390, 420).sc, camera(sans, 390, 420).sc);
  // Les bornes du zoom suivent la même hauteur : dézoomée au plus, la vue contient le cadrage par défaut.
  const k = bornerCadrage({ k: 0.1, ox: 0, oy: -1000 }, 910, 720, hauteurVue(s, 910, 720));
  assert.ok(Math.abs(k.oy) <= (720 / 2 / echelleDefaut(910, 720, hauteurVue(s, 910, 720))) * (1 / k.k - 1) + 1e-9);
});
