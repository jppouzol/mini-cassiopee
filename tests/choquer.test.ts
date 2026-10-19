// Choquer une aussière : elle file sans retenir le bateau, puis on la bloque.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bow, line, loadSituation, run, start } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { reglerEquipier } from '../src/situations/edit.ts';
import { SituationError, parseSituation, type Situation } from '../src/situations/schema.ts';
import { Session } from '../src/session/session.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';

const snap = (s: unknown) => JSON.stringify(s);

test('garde avant choquée en marche avant : le bateau avance le long du quai sans être retenu', () => {
  const retenu = start('depart-garde-avant');
  retenu.engine = 1;
  run(retenu, 5);
  const s = start('depart-garde-avant');
  s.engine = 1;
  const garde = line(s, 'garde-av');
  const l0 = garde.len;
  garde.mode = 'choque';
  run(s, 5);
  // Étrave à x = 5 m au départ.
  assert.ok(bow(s)[0] > 7, `le bateau a avancé (étrave à ${bow(s)[0].toFixed(2)} m)`);
  assert.ok(bow(retenu)[0] < 5.6, 'sans choquer, la garde le retient');
  assert.equal(garde.tension, 0, 'la garde ne retient plus');
  assert.ok(garde.len > l0 + 2, 'la garde a filé');
});

test('garde bloquée après avoir filé : le bateau est de nouveau retenu', () => {
  const s = start('depart-garde-avant');
  s.engine = 1;
  const garde = line(s, 'garde-av');
  garde.mode = 'choque';
  run(s, 3);
  garde.mode = 'bloque';
  const lb = garde.len;
  const xb = s.body.x;
  let tendue = false;
  for (let i = 0; i < 5; i++) {
    run(s, 1);
    if (garde.tension > 500) tendue = true;
  }
  assert.equal(garde.len, lb, 'la longueur ne change plus');
  assert.ok(tendue, 'la garde travaille de nouveau');
  assert.ok(Math.abs(s.body.x - xb) < 0.6, `le bateau n’avance plus (Δx = ${(s.body.x - xb).toFixed(2)})`);
});

test('une aussière molle choquée ne change rien tant qu’elle reste molle', () => {
  const molle: Situation = {
    ...loadSituation('depart-garde-avant'),
    aussieres: loadSituation('depart-garde-avant').aussieres.map((a) => ({ ...a, mou: 0.5 })),
  };
  const a = buildState(molle);
  const b = buildState(molle);
  a.engine = 1;
  b.engine = 1;
  b.lines[0].mode = 'choque';
  run(a, 1);
  run(b, 1);
  assert.equal(b.lines[0].len, a.lines[0].len);
  assert.equal(snap(b.body), snap(a.body));
});

test('une aussière qui file au départ se comporte comme une aussière choquée à la première image', () => {
  const sit = loadSituation('depart-garde-avant');
  const depart = new Session(buildState(reglerEquipier(sit, 'garde-av', 'choque')), DEFAULT_PARAMS);
  const choquee = new Session(buildState(sit), DEFAULT_PARAMS);
  depart.act({ type: 'engine', value: 1 });
  choquee.act({ type: 'engine', value: 1 });
  choquee.act({ type: 'line-mode', lineId: 'garde-av', value: 'choque' });
  depart.advance(240);
  choquee.advance(240);
  assert.equal(snap(depart.state), snap(choquee.state));
  assert.ok(depart.state.body.x > 1);
});

function scripted(): Session {
  const ses = new Session(start('depart-garde-avant'), DEFAULT_PARAMS);
  ses.act({ type: 'engine', value: 1 });
  ses.advance(120);
  ses.act({ type: 'line-mode', lineId: 'garde-av', value: 'choque' });
  ses.advance(180);
  ses.act({ type: 'line-mode', lineId: 'garde-av', value: 'bloque' });
  ses.advance(300);
  return ses;
}

test('relecture : choquer puis bloquer redonne exactement le même état', () => {
  const ses = scripted();
  const fin = snap(ses.state);
  ses.seek(200);
  const mid = snap(ses.state);
  assert.equal(ses.state.lines[0].mode, 'choque');
  ses.seek(0);
  assert.equal(ses.state.lines[0].mode, 'bloque');
  ses.seek(600);
  assert.equal(snap(ses.state), fin);
  ses.seek(200);
  assert.equal(snap(ses.state), mid);
});

test('basculer en pause, après un retour arrière, équivaut à basculer en lecture à la même image', () => {
  const ses = scripted();
  ses.seek(400);
  ses.act({ type: 'line-mode', lineId: 'garde-av', value: 'choque' });
  assert.equal(ses.lastFrame, 400, 'la suite enregistrée est effacée');
  ses.advance(200);
  const direct = new Session(start('depart-garde-avant'), DEFAULT_PARAMS);
  direct.act({ type: 'engine', value: 1 });
  direct.advance(120);
  direct.act({ type: 'line-mode', lineId: 'garde-av', value: 'choque' });
  direct.advance(180);
  direct.act({ type: 'line-mode', lineId: 'garde-av', value: 'bloque' });
  direct.advance(100);
  direct.act({ type: 'line-mode', lineId: 'garde-av', value: 'choque' });
  direct.advance(200);
  assert.equal(snap(ses.state), snap(direct.state));
});

test('larguer une aussière qui file la fait disparaître', () => {
  const ses = new Session(start('depart-garde-avant'), DEFAULT_PARAMS);
  ses.act({ type: 'engine', value: 1 });
  ses.act({ type: 'line-mode', lineId: 'garde-av', value: 'choque' });
  ses.advance(60);
  ses.act({ type: 'cast-off', lineId: 'garde-av' });
  const len = ses.state.lines[0].len;
  ses.advance(120);
  assert.equal(ses.state.lines[0].attached, false);
  assert.equal(ses.state.lines[0].len, len, 'une aussière larguée ne file plus');
  assert.equal(ses.state.lines[0].tension, 0);
});

test('format : « file »: true, ancienne écriture, est lu comme « equipier »: « choque »', () => {
  const brut = JSON.parse(JSON.stringify(loadSituation('depart-garde-avant')));
  assert.equal(parseSituation(brut).aussieres[0].equipier, undefined);
  brut.aussieres[0].file = true;
  assert.equal(parseSituation(brut).aussieres[0].equipier, 'choque');
  assert.ok(!('file' in parseSituation(brut).aussieres[0]), 'seul « equipier » est gardé');
  assert.equal(buildState(parseSituation(brut)).lines[0].mode, 'choque');
  brut.aussieres[0].file = false;
  assert.ok(!('equipier' in parseSituation(brut).aussieres[0]));
  brut.aussieres[0].file = 'oui';
  assert.throws(() => parseSituation(brut), SituationError);
});

test('éditeur : régler une aussière entre bloquée et choquée au départ', () => {
  const sit = loadSituation('depart-garde-avant');
  const file = reglerEquipier(sit, 'garde-av', 'choque');
  assert.equal(file.aussieres[0].equipier, 'choque');
  assert.equal(sit.aussieres[0].equipier, undefined, 'la situation d’origine est intacte');
  const bloquee = reglerEquipier(file, 'garde-av', null);
  assert.ok(!('equipier' in bloquee.aussieres[0]));
  assert.equal(buildState(bloquee).lines[0].mode, 'bloque');
});
