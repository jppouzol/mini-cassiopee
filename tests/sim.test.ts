// Scénarios de référence du moteur : on vérifie des comportements, pas des valeurs exactes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bow, deg, line, loadSituation, run, start, stern } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';

test('au repos, sans vent, le bateau ne bouge pas', () => {
  const s = start('depart-garde-avant');
  run(s, 10);
  assert.ok(Math.hypot(s.body.x, s.body.y + 1.75) < 0.01);
  assert.ok(Math.abs(s.body.th) < 1e-3);
});

test('garde avant en marche avant : l’étrave reste en appui et l’arrière décolle', () => {
  const s = start('depart-garde-avant');
  s.engine = 1;
  run(s, 10);
  assert.ok(deg(s.body.th) > 10, `cap ${deg(s.body.th).toFixed(1)}°`);
  assert.ok(bow(s)[1] > -0.6, 'l’étrave reste près du quai');
  assert.ok(stern(s)[1] < -3, 'l’arrière s’est écarté du quai');
  assert.ok(s.pivot !== null && s.pivot > 2.5, `pivot à l’avant (${s.pivot})`);
  assert.ok(line(s, 'garde-av').tension > 500, 'la garde travaille');
  assert.ok(s.contacts.length > 0, 'appui sur le quai');
});

test('la barre côté quai accélère le pivot sur garde avant', () => {
  const sans = start('depart-garde-avant');
  sans.engine = 1;
  run(sans, 8);
  const avec = start('depart-garde-avant');
  avec.engine = 1;
  avec.rudder = (25 * Math.PI) / 180;
  run(avec, 8);
  assert.ok(avec.body.th > sans.body.th * 1.3, `${deg(avec.body.th).toFixed(1)}° contre ${deg(sans.body.th).toFixed(1)}°`);
});

test('garde avant, phase 2 : marche arrière et garde larguée, le bateau se dégage', () => {
  const s = start('depart-garde-avant');
  s.engine = 1;
  s.rudder = (25 * Math.PI) / 180;
  run(s, 10);
  s.engine = -1;
  s.rudder = 0;
  line(s, 'garde-av').attached = false;
  let touched = false;
  for (let i = 0; i < 60 * 8; i++) {
    tick(s, DEFAULT_PARAMS);
    if (i > 60 && s.contacts.length > 0) touched = true;
  }
  assert.ok(!touched, 'pas de contact avec le quai après le dégagement');
  assert.ok(s.body.y < -5, `le bateau s’est éloigné (y = ${s.body.y.toFixed(2)})`);
});

test('garde arrière en marche arrière : le pivot passe à l’arrière et l’étrave décolle', () => {
  const s = start('depart-garde-arriere');
  s.engine = -1;
  run(s, 10);
  assert.ok(deg(s.body.th) < -6, `cap ${deg(s.body.th).toFixed(1)}°`);
  assert.ok(bow(s)[1] < -3, 'l’étrave s’est écartée');
  assert.ok(stern(s)[1] > -2, 'l’arrière reste près du quai');
  assert.ok(s.pivot !== null && s.pivot < -3, `pivot à l’arrière (${s.pivot})`);
});

test('quatre amarres et vent soutenu du quai : l’amarrage tient', () => {
  const s = start('amarre-quatre-amarres');
  run(s, 20);
  assert.ok(Math.hypot(s.body.x, s.body.y + 1.75) < 0.2, 'déplacement inférieur à 20 cm');
  assert.ok(s.lines.filter((l) => l.tension > 30).length >= 3, 'les aussières travaillent');
  assert.ok(Math.abs(s.body.w) < 1e-3, 'pas d’oscillation');
});

test('vent du large : le bateau est plaqué contre le quai, les aussières sont molles', () => {
  const s = start('amarre-quatre-amarres', { direction: 'large', force: 'soutenu' });
  run(s, 10);
  assert.ok(s.contacts.length > 0);
  assert.ok(s.lines.every((l) => l.tension < 30));
});

test('aucune amarre et vent du quai : le bateau dérive vers le large', () => {
  const s = start('depart-garde-avant', { direction: 'quai', force: 'soutenu' });
  line(s, 'garde-av').attached = false;
  run(s, 15);
  assert.ok(s.body.y < -5);
});

test('stabilité : moteur sur quatre amarres, pas d’oscillation après 10 s', () => {
  for (const engine of [1, -1] as const) {
    const s = start('amarre-quatre-amarres');
    s.engine = engine;
    s.rudder = -0.6;
    run(s, 10);
    let maxW = 0;
    for (let i = 0; i < 60 * 10; i++) {
      tick(s, DEFAULT_PARAMS);
      maxW = Math.max(maxW, Math.abs(s.body.w));
    }
    assert.ok(maxW < 0.01, `lacet résiduel ${maxW}`);
  }
});

test('tribord au quai : le départ sur garde avant est le symétrique', () => {
  const sit = loadSituation('depart-garde-avant');
  const tri = buildState({ ...sit, bateau: { ...sit.bateau, bordAuQuai: 'tribord' } });
  tri.engine = 1;
  run(tri, 8);
  const ref = start('depart-garde-avant');
  ref.engine = 1;
  run(ref, 8);
  assert.ok(Math.abs(tri.body.x + ref.body.x) < 0.02, 'x symétrique');
  assert.ok(Math.abs(tri.body.y - ref.body.y) < 0.02, 'y identique');
  assert.ok(Math.abs(tri.body.th - (Math.PI - ref.body.th)) < 0.01, 'cap symétrique');
});
