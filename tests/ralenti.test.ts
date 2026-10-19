// Ralenti (#67) : en avant comme en arrière, la poussée est réduite de `idleFactor`, avec le
// flux d'hélice sur le safran et le pas d'hélice. Le coup de fouet garde sa poussée depuis le
// ralenti, puis le moteur y revient. La marche avant et arrière ne changent pas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bow, deg, line, loadSituation, run, start, stern } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { reglerPasHelice } from '../src/situations/edit.ts';
import { tick } from '../src/sim/engine.ts';
import { ENGINE_POSITIONS, startKick, thrustOf } from '../src/sim/kick.ts';
import { DEFAULT_PARAMS, FPS } from '../src/sim/params.ts';
import { Session } from '../src/session/session.ts';
import type { Engine, SimState } from '../src/sim/types.ts';

/** Vitesse longitudinale (m/s), positive vers l'avant. */
const erre = (s: SimState) => Math.cos(s.body.th) * s.body.vx + Math.sin(s.body.th) * s.body.vy;

/** Bateau libre arrêté, sans vent, moteur réglé. */
function libre(engine: Engine): SimState {
  const s = start('eau-libre');
  s.engine = engine;
  return s;
}

/** Bateau libre arrêté, hélice à droite, moteur réglé, barre au centre. */
function helice(engine: Engine): SimState {
  const s = buildState(reglerPasHelice(loadSituation('eau-libre-pas-helice'), 'droite'));
  s.engine = engine;
  return s;
}

test('positions du moteur : de la marche arrière à la marche avant, un ralenti de chaque côté du neutre', () => {
  assert.deepEqual(ENGINE_POSITIONS, [-1, -0.5, 0, 0.5, 1]);
  const s = libre(0);
  const facteur = (e: Engine) => { s.engine = e; return thrustOf(s, DEFAULT_PARAMS); };
  assert.deepEqual(facteur(1), { dir: 1, factor: 1 }, 'marche avant inchangée');
  assert.deepEqual(facteur(-1), { dir: -1, factor: 1 }, 'marche arrière inchangée');
  assert.deepEqual(facteur(0.5), { dir: 1, factor: DEFAULT_PARAMS.idleFactor });
  assert.deepEqual(facteur(-0.5), { dir: -1, factor: DEFAULT_PARAMS.idleFactor });
  assert.equal(facteur(0).dir, 0);
});

test('ralenti, bateau libre sans vent : plus lent qu’en marche, en avant comme en arrière', () => {
  for (const sens of [1, -1] as const) {
    const ralenti = libre((sens * 0.5) as Engine), marche = libre(sens);
    run(ralenti, 60);
    run(marche, 60);
    const vr = sens * erre(ralenti), vm = sens * erre(marche);
    assert.ok(vr > 0.3, `ralenti : ${vr.toFixed(2)} m/s dans le bon sens`);
    assert.ok(vr > 0.5 * vm && vr < 0.85 * vm, `ralenti ${vr.toFixed(2)} m/s, marche ${vm.toFixed(2)} m/s`);
  }
});

test('pas d’hélice au ralenti arrière : l’arrière part du même côté qu’en marche arrière, plus doucement', () => {
  const ralenti = helice(-0.5), marche = helice(-1);
  run(ralenti, 5);
  run(marche, 5);
  // Hélice à droite, l'arrière part vers bâbord : l'étrave abat vers tribord (cap négatif).
  const capR = -deg(ralenti.body.th), capM = -deg(marche.body.th);
  assert.ok(capR > 1.5, `ralenti : ${capR.toFixed(1)}° en 5 s`);
  assert.ok(capR < 0.75 * capM, `ralenti ${capR.toFixed(1)}°, marche ${capM.toFixed(1)}°`);
});

test('départ sur garde avant au ralenti : l’arrière s’écarte du quai, moins vite qu’en marche', () => {
  const ralenti = start('depart-garde-avant'), marche = start('depart-garde-avant');
  ralenti.engine = 0.5;
  marche.engine = 1;
  const y0 = stern(ralenti)[1], b0 = bow(ralenti)[1];
  run(ralenti, 10);
  run(marche, 10);
  const er = y0 - stern(ralenti)[1], em = y0 - stern(marche)[1];
  assert.ok(er > 0.5, `ralenti : ${er.toFixed(2)} m en 10 s`);
  assert.ok(er < 0.8 * em, `ralenti ${er.toFixed(2)} m, marche ${em.toFixed(2)} m`);
  assert.ok(bow(ralenti)[1] > b0, 'l’étrave reste en appui sur le quai');
});

test('départ sur garde arrière au ralenti : l’étrave s’écarte du quai, moins vite qu’en marche', () => {
  const ralenti = start('depart-garde-arriere'), marche = start('depart-garde-arriere');
  ralenti.engine = -0.5;
  marche.engine = -1;
  const y0 = bow(ralenti)[1];
  run(ralenti, 10);
  run(marche, 10);
  const er = y0 - bow(ralenti)[1], em = y0 - bow(marche)[1];
  assert.ok(er > 0.4, `ralenti : ${er.toFixed(2)} m en 10 s`);
  assert.ok(er < 0.8 * em, `ralenti ${er.toFixed(2)} m, marche ${em.toFixed(2)} m`);
});

test('garde avant au maître-bau, ralenti avant et barre au large : le bateau tient le long du quai, la garde travaille moins', () => {
  const BARRE_AU_LARGE = (-30 * Math.PI) / 180;
  const ralenti = start('garde-maitre-bau'), marche = start('garde-maitre-bau');
  ralenti.engine = 0.5;
  marche.engine = 1;
  ralenti.rudder = marche.rudder = BARRE_AU_LARGE;
  run(ralenti, 30);
  run(marche, 30);
  assert.ok(Math.abs(deg(ralenti.body.th)) < 2, `cap ${deg(ralenti.body.th).toFixed(1)}°`);
  assert.ok(Math.abs(ralenti.body.x) < 1, 'la garde retient le bateau');
  assert.ok(bow(ralenti)[1] > -2.2 && stern(ralenti)[1] > -2.2, 'étrave et arrière restent au quai');
  assert.ok(Math.abs(ralenti.body.w) < 1e-3, 'pas d’oscillation');
  const tr = line(ralenti, 'garde-mb').tension, tm = line(marche, 'garde-mb').tension;
  assert.ok(tr > 200 && tr < 0.7 * tm, `tension au ralenti ${tr.toFixed(0)} N, en marche ${tm.toFixed(0)} N`);
});

test('coup de fouet depuis le ralenti : même poussée que depuis la marche, puis retour au ralenti', () => {
  for (const sens of [1, -1] as const) {
    const depuisRalenti = libre((sens * 0.5) as Engine);
    startKick(depuisRalenti, sens);
    assert.equal(depuisRalenti.engine, sens * 0.5, 'la commande montre le ralenti, position de retour');
    assert.deepEqual(thrustOf(depuisRalenti, DEFAULT_PARAMS), { dir: sens, factor: DEFAULT_PARAMS.kickFactor });
    let n = 0;
    while (depuisRalenti.kick && n < 10 * FPS) { tick(depuisRalenti, DEFAULT_PARAMS); n++; }
    assert.equal(n, Math.round(DEFAULT_PARAMS.kickTime * FPS), 'coup de durée fixe');
    assert.equal(depuisRalenti.engine, sens * 0.5, 'retour au ralenti');
  }
});

test('coup à contre-sens depuis le ralenti avant : il casse l’erre et le moteur revient au neutre', () => {
  const s = libre(0.5);
  run(s, 20);
  assert.ok(erre(s) > 0.8, `erre de départ ${erre(s).toFixed(2)} m/s`);
  startKick(s, -1);
  assert.equal(s.engine, 0);
  assert.ok(s.kick?.brake, 'le coup casse l’erre');
  let n = 0;
  while (s.kick && n < 10 * FPS) { tick(s, DEFAULT_PARAMS); n++; }
  assert.ok(Math.abs(erre(s)) < 0.02, `erre restante ${erre(s).toFixed(3)} m/s`);
  assert.equal(s.engine, 0);
});

test('relecture : une manœuvre au ralenti se rejoue à l’identique', () => {
  const ses = new Session(buildState(reglerPasHelice(loadSituation('depart-garde-avant'), 'droite')), DEFAULT_PARAMS);
  ses.act({ type: 'engine', value: 0.5 });
  ses.advance(300);
  ses.act({ type: 'kick', value: 1 });
  ses.advance(200);
  ses.act({ type: 'engine', value: -0.5 });
  ses.advance(400);
  const fin = JSON.stringify(ses.state);
  assert.equal(ses.state.engine, -0.5);
  for (const f of [0, 150, 320, 640]) {
    ses.seek(f);
    ses.seek(900);
    assert.equal(JSON.stringify(ses.state), fin, `après un retour à l’image ${f}`);
  }
});
