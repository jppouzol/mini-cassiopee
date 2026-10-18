// Coup de fouet (#20) : poussée brève et forte du moteur, en avant ou en arrière, suivie d'un
// retour automatique. Depuis le neutre ou dans le sens du moteur, il dure 2 s et le moteur
// reprend sa position ; à contre-sens, il casse l'erre (au plus 5 s) et le moteur revient au
// neutre. Une action moteur l'arrête ; un nouveau coup le remplace.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deg, loadSituation, run, start, stern } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { reglerPasHelice } from '../src/situations/edit.ts';
import { tick } from '../src/sim/engine.ts';
import { startKick } from '../src/sim/kick.ts';
import { DEFAULT_PARAMS, FPS } from '../src/sim/params.ts';
import { Session, applyAction } from '../src/session/session.ts';
import type { Engine, SimState } from '../src/sim/types.ts';

/** Barre à fond : le maximum proposé par l'interface. */
const BARRE_MAX = (35 * Math.PI) / 180;
const DUREE = DEFAULT_PARAMS.kickTime;

/** Vitesse longitudinale (m/s), positive vers l'avant. */
const erre = (s: SimState) => Math.cos(s.body.th) * s.body.vx + Math.sin(s.body.th) * s.body.vy;

/** Bateau libre arrêté, sans vent, moteur et barre réglés. */
function libre(engine: Engine, rudder = 0): SimState {
  const s = start('eau-libre');
  s.engine = engine;
  s.rudder = rudder;
  return s;
}

/** Simule image par image jusqu'à la fin du coup ; renvoie sa durée (s). */
function jusquaFinDuCoup(s: SimState, max = 10): number {
  let n = 0;
  while (s.kick && n < max * FPS) { tick(s, DEFAULT_PARAMS); n++; }
  return n / FPS;
}

test('coup avant, barre à fond : l’arrière pivote plus nettement qu’en marche avant simple, sur la même durée', () => {
  for (const signe of [1, -1]) {
    const coup = libre(0, signe * BARRE_MAX);
    startKick(coup, 1);
    const simple = libre(1, signe * BARRE_MAX);
    run(coup, DUREE);
    run(simple, DUREE);
    const capCoup = signe * deg(coup.body.th), capSimple = signe * deg(simple.body.th);
    assert.ok(capSimple > 2, `marche avant : ${capSimple.toFixed(1)}°`);
    assert.ok(capCoup > 1.6 * capSimple, `coup : ${capCoup.toFixed(1)}°, marche avant : ${capSimple.toFixed(1)}°`);
  }
});

test('coup avant sur la garde avant : l’arrière décolle plus vite qu’en marche avant simple', () => {
  const coup = start('depart-garde-avant');
  startKick(coup, 1);
  const simple = start('depart-garde-avant');
  simple.engine = 1;
  const y0 = stern(coup)[1];
  run(coup, DUREE);
  run(simple, DUREE);
  const ecartCoup = y0 - stern(coup)[1], ecartSimple = y0 - stern(simple)[1];
  assert.ok(ecartSimple > 0.1, `marche avant : ${ecartSimple.toFixed(2)} m`);
  assert.ok(ecartCoup > 1.6 * ecartSimple, `coup : ${ecartCoup.toFixed(2)} m, marche avant : ${ecartSimple.toFixed(2)} m`);
});

test('depuis le neutre : coup de 2 s, puis retour au neutre', () => {
  const s = libre(0);
  startKick(s, 1);
  assert.equal(s.engine, 0, 'la commande moteur montre la position de retour');
  assert.ok(Math.abs(jusquaFinDuCoup(s) - DUREE) < 1.5 / FPS);
  assert.equal(s.kick, null);
  assert.equal(s.engine, 0);
});

test('coup dans le sens du moteur : poussée doublée pendant le coup seulement, puis retour en marche', () => {
  const coup = libre(1), simple = libre(1);
  startKick(coup, 1);
  run(coup, DUREE);
  run(simple, DUREE);
  assert.equal(coup.kick, null);
  assert.equal(coup.engine, 1, 'retour en marche avant');
  assert.ok(erre(coup) > 1.6 * erre(simple), 'le coup a donné plus d’erre');
  // Après le coup, même poussée : l'écart d'erre se réduit.
  const ecart = erre(coup) - erre(simple);
  run(coup, 10);
  run(simple, 10);
  assert.ok(erre(coup) - erre(simple) < ecart / 2, 'même poussée après le coup');
});

test('coup arrière depuis la marche arrière : retour en marche arrière', () => {
  const s = libre(-1);
  startKick(s, -1);
  jusquaFinDuCoup(s);
  assert.equal(s.engine, -1);
});

test('coup à contre-sens : il casse l’erre, s’arrête à l’erre nulle et le moteur revient au neutre', () => {
  const s = libre(1);
  run(s, 20);
  assert.ok(erre(s) > 1.5, `erre de départ ${erre(s).toFixed(2)} m/s`);
  startKick(s, -1);
  assert.equal(s.engine, 0, 'le moteur reviendra au neutre');
  assert.ok(s.kick?.brake);
  const duree = jusquaFinDuCoup(s);
  assert.ok(duree > DUREE && duree < DEFAULT_PARAMS.kickMaxTime, `coup de ${duree.toFixed(2)} s`);
  assert.ok(Math.abs(erre(s)) < 0.02, `erre restante ${erre(s).toFixed(3)} m/s`);
  assert.equal(s.engine, 0);
});

test('coup à contre-sens sans erre : bateau retenu par la garde, durée fixe puis neutre', () => {
  const s = start('depart-garde-avant');
  s.engine = 1;
  run(s, 5);
  assert.ok(Math.abs(erre(s)) < 0.05, 'le bateau est retenu par la garde');
  startKick(s, -1);
  assert.equal(s.kick?.brake, false);
  assert.ok(Math.abs(jusquaFinDuCoup(s) - DUREE) < 1.5 / FPS);
  assert.equal(s.engine, 0);
});

test('coup à contre-sens : plafond de 5 s quand l’erre ne tombe pas', () => {
  const p = { ...DEFAULT_PARAMS, kickFactor: 0.05 };
  const s = libre(1);
  run(s, 20);
  startKick(s, -1);
  let n = 0;
  while (s.kick && n < 20 * FPS) { tick(s, p); n++; }
  assert.equal(n, DEFAULT_PARAMS.kickMaxTime * FPS);
  assert.ok(erre(s) > 0.3, 'le bateau avance encore');
  assert.equal(s.engine, 0);
});

test('une action moteur arrête le coup et s’applique tout de suite', () => {
  const s = libre(0);
  applyAction(s, { type: 'kick', value: 1 });
  run(s, 0.5);
  applyAction(s, { type: 'engine', value: -1 });
  assert.equal(s.kick, null);
  assert.equal(s.engine, -1);
});

test('nouveau coup dans le même sens : la durée repart', () => {
  const s = libre(0);
  startKick(s, 1);
  run(s, 1.5);
  startKick(s, 1);
  assert.ok(Math.abs(jusquaFinDuCoup(s) - DUREE) < 1.5 / FPS);
  assert.equal(s.engine, 0);
});

test('nouveau coup à contre-sens de la position de retour : il casse l’erre et ramène au neutre', () => {
  const s = libre(1);
  run(s, 20);
  startKick(s, 1);
  run(s, 1);
  startKick(s, -1);
  assert.equal(s.kick?.dir, -1);
  assert.ok(s.kick?.brake);
  assert.equal(s.engine, 0);
  jusquaFinDuCoup(s);
  assert.ok(Math.abs(erre(s)) < 0.02);
});

test('nouveau coup inverse depuis le neutre : durée fixe, retour au neutre', () => {
  const s = libre(0);
  startKick(s, 1);
  run(s, 1);
  startKick(s, -1);
  assert.equal(s.kick?.brake, false);
  assert.ok(Math.abs(jusquaFinDuCoup(s) - DUREE) < 1.5 / FPS);
  assert.equal(s.engine, 0);
});

test('pas d’hélice : un coup arrière depuis l’arrêt fait partir l’arrière de côté plus vite', () => {
  const sit = reglerPasHelice(loadSituation('eau-libre-pas-helice'), 'droite');
  const coup = buildState(sit), simple = buildState(sit);
  startKick(coup, -1);
  simple.engine = -1;
  run(coup, DUREE);
  run(simple, DUREE);
  // Hélice à droite, en marche arrière : l'arrière part vers bâbord, le cap diminue.
  assert.ok(deg(simple.body.th) < -1, `marche arrière : ${deg(simple.body.th).toFixed(1)}°`);
  assert.ok(deg(coup.body.th) < 1.4 * deg(simple.body.th), `coup : ${deg(coup.body.th).toFixed(1)}°`);
});

test('relecture : une manœuvre avec coups de fouet se rejoue à l’identique', () => {
  const ses = new Session(start('depart-garde-avant'), DEFAULT_PARAMS);
  ses.act({ type: 'rudder', value: 0.4 });
  ses.act({ type: 'kick', value: 1 });
  ses.advance(300);
  ses.act({ type: 'engine', value: 1 });
  ses.advance(200);
  ses.act({ type: 'kick', value: -1 });
  ses.advance(400);
  const fin = JSON.stringify(ses.state);
  for (const f of [0, 100, 130, 450, 777]) {
    ses.seek(f);
    ses.seek(900);
    assert.equal(JSON.stringify(ses.state), fin, `après un retour à l’image ${f}`);
  }
});

test('un coup demandé en pause équivaut au même coup demandé en lecture à la même image', () => {
  const lecture = new Session(start('eau-libre'), DEFAULT_PARAMS);
  lecture.advance(90);
  lecture.act({ type: 'kick', value: 1 });
  lecture.advance(300);
  const pause = new Session(start('eau-libre'), DEFAULT_PARAMS);
  pause.advance(200);
  pause.seek(90);
  pause.act({ type: 'kick', value: 1 });
  pause.advance(300);
  assert.equal(JSON.stringify(pause.state), JSON.stringify(lecture.state));
});
