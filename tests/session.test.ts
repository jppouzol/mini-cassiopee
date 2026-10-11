import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.ts';
import { Session } from '../src/session/session.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';

const snap = (s: unknown) => JSON.stringify(s);

function scripted(): Session {
  const ses = new Session(start('depart-garde-avant'), DEFAULT_PARAMS);
  ses.act({ type: 'engine', value: 1 });
  ses.act({ type: 'rudder', value: 0.4 });
  ses.advance(600);
  ses.act({ type: 'engine', value: -1 });
  ses.act({ type: 'cast-off', lineId: 'garde-av' });
  ses.advance(300);
  return ses;
}

test('relecture : revenir en arrière puis rejouer redonne exactement le même état', () => {
  const ses = scripted();
  const fin = snap(ses.state);
  for (const f of [0, 1, 59, 60, 61, 455, 600, 601, 899]) {
    ses.seek(f);
    assert.equal(ses.frame, f);
  }
  ses.seek(450);
  const mid = snap(ses.state);
  ses.seek(900);
  assert.equal(snap(ses.state), fin);
  ses.seek(10);
  ses.seek(450);
  assert.equal(snap(ses.state), mid);
});

test('relecture : avancer pas à pas équivaut à sauter directement', () => {
  const a = scripted();
  a.seek(123);
  for (let i = 0; i < 400; i++) a.advance(1);
  const b = scripted();
  b.seek(523);
  assert.equal(snap(a.state), snap(b.state));
});

test('une action dans le passé efface la suite enregistrée', () => {
  const ses = scripted();
  assert.equal(ses.lastFrame, 900);
  ses.seek(300);
  ses.act({ type: 'engine', value: 0 });
  assert.equal(ses.lastFrame, 300);
  ses.advance(10);
  assert.equal(ses.state.engine, 0);
  assert.equal(ses.state.lines[0].attached, true, 'le largage enregistré plus tard a été effacé');
});

test('la session ne dépasse pas la fin enregistrée lors d’un retour', () => {
  const ses = scripted();
  ses.seek(5000);
  assert.equal(ses.frame, 900);
  ses.seek(-10);
  assert.equal(ses.frame, 0);
});
