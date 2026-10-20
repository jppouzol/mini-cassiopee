// Reprendre une aussière (#22) : l'équipier l'embraque tant que la tension reste sous son
// effort, et lâche quand le bateau tire au-delà ; l'aussière passe alors d'elle-même sur
// Choquer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bow, line, loadSituation, run, start } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { reglerEquipier } from '../src/situations/edit.ts';
import { SituationError, parseSituation, type Situation } from '../src/situations/schema.ts';
import { Session } from '../src/session/session.ts';
import { tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { toWorld } from '../src/sim/geometry.ts';
import type { MooringLine, SimState } from '../src/sim/types.ts';
import { sensDuBout, TAUT_THRESHOLD } from '../src/render/renderer.ts';

const snap = (s: unknown) => JSON.stringify(s);
const LACHER = DEFAULT_PARAMS.crewEffort * (1 + DEFAULT_PARAMS.crewMargin);

/** Distance du taquet à la bitte (m). */
function portee(s: SimState, l: MooringLine): number {
  const p = toWorld(s.body, l.cleat);
  return Math.hypot(p[0] - l.bollard[0], p[1] - l.bollard[1]);
}

/** Traversier tendu au départ (sans mou). */
function tendu(): Situation {
  const sit = loadSituation('reprise-traversier');
  return { ...sit, aussieres: sit.aussieres.map((a) => ({ ...a, mou: 0 })) };
}

/** Simule seconde par seconde, en notant si l'équipier a lâché. */
function suivre(s: SimState, l: MooringLine, seconds: number): { lache: boolean } {
  let lache = false;
  for (let i = 0; i < seconds; i++) {
    run(s, 1);
    if (l.mode !== 'reprend') lache = true;
  }
  return { lache };
}

test('aussière molle reprise : le mou est rattrapé, puis elle est tendue', () => {
  const s = start('reprise-traversier');
  const l = line(s, 'trav');
  const d0 = portee(s, l);
  assert.ok(l.len > d0 + 0.4, 'molle au départ');
  l.mode = 'reprend';
  run(s, 1);
  assert.ok(l.len < d0 + 0.3, 'le mou se rattrape');
  assert.equal(sensDuBout(l), 'rentre', 'chevron tourné vers le taquet');
  run(s, 2);
  assert.ok(l.tension > TAUT_THRESHOLD, `tendue (${l.tension.toFixed(0)} N)`);
  assert.equal(l.mode, 'reprend', 'l’équipier tient');
});

test('sans vent, reprise d’un traversier : le bateau se rapproche de la bitte, sans que l’équipier lâche', () => {
  const s = buildState(tendu());
  const l = line(s, 'trav');
  const y0 = s.body.y;
  const d0 = portee(s, l);
  l.mode = 'reprend';
  let tmax = 0;
  for (let i = 0; i < 10 * 60; i++) {
    tick(s, DEFAULT_PARAMS);
    tmax = Math.max(tmax, l.tension);
    assert.equal(l.mode, 'reprend', `l’équipier ne lâche pas à la fin de sa propre reprise (image ${s.frame})`);
  }
  assert.ok(portee(s, l) < d0 - 1, `le taquet s’est rapproché de la bitte (${d0.toFixed(2)} → ${portee(s, l).toFixed(2)} m)`);
  assert.ok(s.body.y > y0 + 1, 'le bateau vient vers le quai');
  assert.ok(tmax < LACHER, `la tension reste sous le seuil du lâcher (${tmax.toFixed(0)} N)`);
  assert.equal(sensDuBout(l), 'rentre');
});

test('contre un vent faible qui écarte le bateau du quai, l’équipier le déhale', () => {
  const s = buildState(loadSituation('reprise-traversier'), { direction: 'quai', force: 'faible' });
  const l = line(s, 'trav');
  const y0 = s.body.y;
  l.mode = 'reprend';
  const { lache } = suivre(s, l, 15);
  assert.equal(lache, false, 'l’équipier tient, même à l’à-coup du mou rattrapé');
  assert.ok(s.body.y > y0 + 0.5, `le bateau vient au quai contre le vent (Δy = ${(s.body.y - y0).toFixed(2)} m)`);
});

test('contre un vent soutenu, l’équipier ne tient pas : il lâche et l’aussière file', () => {
  const s = buildState(loadSituation('reprise-traversier'), { direction: 'quai', force: 'soutenu' });
  const l = line(s, 'trav');
  const y0 = s.body.y;
  l.mode = 'reprend';
  run(s, 8);
  assert.equal(l.mode, 'choque', 'l’aussière est passée d’elle-même sur Choquer');
  assert.equal(l.attached, true, 'elle n’est pas larguée');
  assert.ok(s.body.y < y0 - 0.5, 'le bateau dérive au large');
  assert.equal(sensDuBout(l), 'file');
});

test('reprise de la garde avant contre la marche avant : l’équipier lâche, le bateau n’est plus retenu', () => {
  const s = start('depart-garde-avant');
  s.engine = 1;
  const garde = line(s, 'garde-av');
  garde.mode = 'reprend';
  run(s, 1);
  assert.equal(garde.mode, 'choque', 'il lâche vite');
  run(s, 4);
  assert.ok(bow(s)[0] > 6.5, `le bateau avance le long du quai (étrave à ${bow(s)[0].toFixed(2)} m)`);
});

test('reprise de la garde avant contre le ralenti avant : il tient un moment, puis lâche', () => {
  const s = start('depart-garde-avant');
  s.engine = 0.5;
  const garde = line(s, 'garde-av');
  garde.mode = 'reprend';
  run(s, 1);
  assert.equal(garde.mode, 'reprend', 'il encaisse d’abord');
  run(s, 6);
  assert.equal(garde.mode, 'choque', 'puis il lâche');
});

test('la reprise s’arrête à la longueur minimale', () => {
  const p = { ...DEFAULT_PARAMS, lineMinLen: 2.2 };
  const s = buildState(tendu());
  const l = line(s, 'trav');
  l.mode = 'reprend';
  for (let i = 0; i < 20 * 60; i++) tick(s, p);
  assert.equal(l.len, 2.2);
  assert.equal(l.mode, 'reprend');
});

function scripted(): Session {
  // Reprise de la garde avant, puis marche avant : l'équipier lâche pendant la manœuvre.
  const ses = new Session(start('depart-garde-avant'), DEFAULT_PARAMS);
  ses.act({ type: 'line-mode', lineId: 'garde-av', value: 'reprend' });
  ses.advance(120);
  ses.act({ type: 'engine', value: 1 });
  ses.advance(300);
  return ses;
}

test('relecture : une reprise et un lâcher se rejouent à l’identique après un retour arrière', () => {
  const ses = scripted();
  assert.equal(ses.state.lines[0].mode, 'choque', 'l’équipier a lâché');
  const fin = snap(ses.state);
  ses.seek(130);
  assert.equal(ses.state.lines[0].mode, 'reprend', 'avant le lâcher, il reprend encore');
  const mid = snap(ses.state);
  ses.seek(0);
  assert.equal(ses.state.lines[0].mode, 'reprend');
  ses.seek(420);
  assert.equal(snap(ses.state), fin);
  ses.seek(130);
  assert.equal(snap(ses.state), mid);
});

test('un cran changé en pause, après un retour arrière, équivaut au même cran changé en lecture à la même image', () => {
  const ses = scripted();
  ses.seek(60);
  ses.act({ type: 'line-mode', lineId: 'garde-av', value: 'bloque' });
  assert.equal(ses.lastFrame, 60, 'la suite enregistrée est effacée');
  ses.advance(200);
  const direct = new Session(start('depart-garde-avant'), DEFAULT_PARAMS);
  direct.act({ type: 'line-mode', lineId: 'garde-av', value: 'reprend' });
  direct.advance(60);
  direct.act({ type: 'line-mode', lineId: 'garde-av', value: 'bloque' });
  direct.advance(200);
  assert.equal(snap(ses.state), snap(direct.state));
});

test('une aussière reprise dès le départ équivaut à une reprise à la première image', () => {
  const sit = loadSituation('reprise-traversier');
  const depart = new Session(buildState(reglerEquipier(sit, 'trav', 'reprend')), DEFAULT_PARAMS);
  const reprise = new Session(buildState(sit), DEFAULT_PARAMS);
  reprise.act({ type: 'line-mode', lineId: 'trav', value: 'reprend' });
  depart.advance(240);
  reprise.advance(240);
  assert.equal(snap(depart.state), snap(reprise.state));
});

test('format : « equipier » vaut choque ou reprend, et ne contredit pas « file »', () => {
  const brut = JSON.parse(JSON.stringify(loadSituation('reprise-traversier')));
  brut.aussieres[0].equipier = 'reprend';
  assert.equal(parseSituation(brut).aussieres[0].equipier, 'reprend');
  assert.equal(buildState(parseSituation(brut)).lines[0].mode, 'reprend');
  brut.aussieres[0].equipier = 'choque';
  assert.equal(buildState(parseSituation(brut)).lines[0].mode, 'choque');
  brut.aussieres[0].file = true;
  assert.equal(parseSituation(brut).aussieres[0].equipier, 'choque', '« file » et « choque » s’accordent');
  brut.aussieres[0].equipier = 'reprend';
  assert.throws(() => parseSituation(brut), SituationError, '« file » et « reprend » se contredisent');
  delete brut.aussieres[0].file;
  brut.aussieres[0].equipier = 'bloque';
  assert.throws(() => parseSituation(brut), SituationError, 'bloquée : le champ est absent');
  brut.aussieres[0].equipier = 'freine';
  assert.throws(() => parseSituation(brut), SituationError, 'pas de freinage');
});

test('éditeur : régler une aussière sur Reprendre dès le départ, puis la rebloquer', () => {
  const sit = loadSituation('reprise-traversier');
  const reprise = reglerEquipier(sit, 'trav', 'reprend');
  assert.equal(reprise.aussieres[0].equipier, 'reprend');
  assert.equal(sit.aussieres[0].equipier, undefined, 'la situation d’origine est intacte');
  assert.equal(reglerEquipier(reprise, 'trav', 'choque').aussieres[0].equipier, 'choque');
  assert.ok(!('equipier' in reglerEquipier(reprise, 'trav', null).aussieres[0]));
});
