// Fardage (#12) : effet optionnel, déclaré sous `options.fardage`. Le vent s'applique vers
// le bout d'où il vient : vent de face, l'équilibre devient instable et l'avant abat ;
// arrêté, le bateau finit à peu près en travers. Vent pile dans l'axe, l'avant abat du
// côté tiré au départ (`options.windage`), noté dans l'état et rejoué à l'identique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deg, loadSituation, rawSituation, run, start } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { reglerFardage, reglerPasHelice } from '../src/situations/edit.ts';
import { SituationError, parseSituation, type Situation } from '../src/situations/schema.ts';
import { BASE_EFFECTS, activeEffects, propWalk, windage } from '../src/sim/effects.ts';
import { cloneState, tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { Session } from '../src/session/session.ts';
import type { Engine, Forces, SimState } from '../src/sim/types.ts';

/** Bateau libre arrêté, étrave vers le haut : écart de cap depuis le départ (degrés), positif vers bâbord. */
const ecartCap = (s: SimState) => deg(s.body.th - Math.PI / 2);

/** Scénario de référence (vent soutenu de l'avant, fardage), avec le vent et le moteur voulus. */
function libre(opts: { fardage?: boolean; abattee?: 1 | -1; vent?: Situation['vent']; engine?: Engine } = {}): SimState {
  const sit = reglerFardage(loadSituation('libre-fardage'), opts.fardage ?? true);
  const s = buildState(sit, opts.vent, opts.abattee ?? 1);
  s.engine = opts.engine ?? 0;
  return s;
}

/** Angle d'où vient le vent, compté depuis l'étrave (degrés, de 0 à 180). */
function angleDuVent(s: SimState): number {
  const c = Math.cos(s.body.th), sn = Math.sin(s.body.th);
  const [dx, dy] = s.wind.to;
  return deg(Math.acos(-(c * dx + sn * dy)));
}

test('le scénario de référence active le fardage, avec le côté tiré au départ', () => {
  const s = start('libre-fardage');
  assert.deepEqual(s.options, { windage: 1 });
  assert.ok(activeEffects(s).includes(windage));
  assert.deepEqual(libre({ abattee: -1 }).options, { windage: -1 });
  assert.deepEqual(libre({ fardage: false }).options, {});
});

test('sans fardage, vent soutenu de l’avant : le bateau recule droit (comportement de base)', () => {
  const s = libre({ fardage: false });
  run(s, 40);
  assert.equal(ecartCap(s), 0);
  assert.ok(s.body.y < -5, 'le bateau a reculé');
});

test('avec fardage, vent soutenu de l’avant, sans commande : l’avant abat en quelques secondes', () => {
  const s = libre();
  run(s, 10);
  assert.ok(ecartCap(s) > 3, `cap à 10 s : ${ecartCap(s).toFixed(1)}°`);
  run(s, 10);
  assert.ok(ecartCap(s) > 20, `cap à 20 s : ${ecartCap(s).toFixed(1)}°`);
});

test('avec fardage, en marche arrière barre au centre : l’avant abat aussi', () => {
  const s = libre({ engine: -1 });
  run(s, 20);
  assert.ok(ecartCap(s) > 20, `cap à 20 s : ${ecartCap(s).toFixed(1)}°`);
});

test('le côté tiré décide de l’abattée : symétrique exact', () => {
  const b = libre({ abattee: 1 }), t = libre({ abattee: -1 });
  run(b, 25);
  run(t, 25);
  assert.ok(ecartCap(b) > 20 && ecartCap(t) < -20);
  assert.ok(Math.abs(ecartCap(b) + ecartCap(t)) < 1e-9, 'caps opposés');
  assert.ok(Math.abs(b.body.x + t.body.x) < 1e-9, 'écarts latéraux opposés');
  assert.ok(Math.abs(b.body.y - t.body.y) < 1e-9, 'même recul');
});

test('vent de face, arrêté : le bateau finit à peu près en travers, vent un peu sur l’arrière du travers', () => {
  const s = libre();
  run(s, 60);
  const a = angleDuVent(s);
  assert.ok(a > 90 && a < 115, `vent à ${a.toFixed(0)}° de l’étrave`);
});

test('vent de l’arrière, arrêté : le bateau ne reste pas arrière au vent, il se met en travers', () => {
  const s = libre({ vent: { direction: 'arriere', force: 'soutenu' } });
  run(s, 60);
  const a = angleDuVent(s);
  assert.ok(a > 80 && a < 115, `vent à ${a.toFixed(0)}° de l’étrave`);
});

test('vent de travers, arrêté : l’avant abat un peu, jusqu’au vent légèrement sur l’arrière du travers', () => {
  const sans = libre({ fardage: false, vent: { direction: 'babord', force: 'soutenu' } });
  const avec = libre({ vent: { direction: 'babord', force: 'soutenu' } });
  run(sans, 30);
  run(avec, 30);
  assert.equal(ecartCap(sans), 0, 'sans fardage, il dérive sans tourner');
  // Vent de bâbord : l'avant abat sous le vent, vers tribord.
  assert.ok(ecartCap(avec) < -3 && ecartCap(avec) > -20, `cap ${ecartCap(avec).toFixed(1)}°`);
  const a = angleDuVent(avec);
  assert.ok(a > 90 && a < 110, `vent à ${a.toFixed(0)}° de l’étrave`);
});

test('effet seul : moment du côté tiré vent de face, nul sans vent', () => {
  const moment = (s: SimState) => {
    const f: Forces = { fx: 0, fy: 0, m: 0 };
    windage(s, DEFAULT_PARAMS, f);
    assert.deepEqual([f.fx, f.fy], [0, 0], 'le fardage n’ajoute qu’un moment');
    return f.m;
  };
  assert.ok(moment(libre({ abattee: 1 })) > 0, 'côté 1 : l’avant part vers bâbord');
  assert.ok(moment(libre({ abattee: -1 })) < 0, 'côté -1 : vers tribord');
  assert.equal(moment(libre({ vent: { direction: 'avant', force: 'aucun' } })), 0);
  assert.equal(moment(libre({ fardage: false })), 0);
});

test('avec fardage, la barre décide du côté, quel que soit le côté tiré', () => {
  // Marche arrière : une barre négative fait venir l'étrave vers bâbord.
  for (const abattee of [1, -1] as const) {
    const s = libre({ abattee, engine: -1 });
    s.rudder = (-20 * Math.PI) / 180;
    run(s, 20);
    assert.ok(ecartCap(s) > 10, `côté tiré ${abattee} : cap ${ecartCap(s).toFixed(1)}°`);
  }
});

test('avec fardage, le pas d’hélice décide du côté, quel que soit le côté tiré', () => {
  // Hélice à droite, en marche arrière, l'arrière part vers bâbord : l'étrave abat vers tribord.
  for (const abattee of [1, -1] as const) {
    const s = buildState(reglerPasHelice(loadSituation('libre-fardage'), 'droite'), undefined, abattee);
    s.engine = -1;
    run(s, 20);
    assert.ok(ecartCap(s) < -10, `côté tiré ${abattee} : cap ${ecartCap(s).toFixed(1)}°`);
  }
});

test('vent de travers, sous moteur barre au centre : le fardage tient l’avant, le bateau ne remonte plus au vent', () => {
  const vent = { direction: 'babord', force: 'soutenu' } as const;
  const sans = libre({ fardage: false, vent, engine: 1 });
  const avec = libre({ vent, engine: 1 }), autre = libre({ vent, engine: 1, abattee: -1 });
  for (const s of [sans, avec, autre]) run(s, 40);
  assert.ok(ecartCap(sans) > 20, `sans fardage, il remonte au vent : ${ecartCap(sans).toFixed(1)}°`);
  assert.ok(Math.abs(ecartCap(avec)) < 10, `avec fardage : ${ecartCap(avec).toFixed(1)}°`);
  assert.ok(Math.abs(ecartCap(autre) - ecartCap(avec)) < 0.1, 'vent de travers, le côté tiré ne change presque rien');
});

test('le long du quai, quatre amarres, vent soutenu du quai : l’amarrage tient avec le fardage', () => {
  const s = buildState(reglerFardage(loadSituation('amarre-quatre-amarres'), true));
  const x0 = s.body.x, y0 = s.body.y;
  run(s, 30);
  assert.ok(Math.hypot(s.body.x - x0, s.body.y - y0) < 0.2, 'le bateau se déplace de moins de 20 cm');
});

test('sans option, la manœuvre est la même, image par image, qu’avec la liste du socle', () => {
  const a = libre({ fardage: false, engine: -1 }), b = cloneState(a);
  a.rudder = b.rudder = 0.2;
  assert.equal(activeEffects(a), BASE_EFFECTS);
  for (let i = 0; i < 10 * 60; i++) {
    tick(a, DEFAULT_PARAMS);
    tick(b, DEFAULT_PARAMS, BASE_EFFECTS);
  }
  assert.deepEqual(a, b);
});

test('pas d’hélice et fardage ensemble : les deux effets, dans un ordre fixe', () => {
  const s = buildState(reglerPasHelice(loadSituation('libre-fardage'), 'droite'), undefined, -1);
  assert.deepEqual(s.options, { propWalk: 'droite', windage: -1 });
  const effets = activeEffects(s);
  assert.deepEqual(effets.slice(0, BASE_EFFECTS.length), [...BASE_EFFECTS]);
  assert.deepEqual(effets.slice(BASE_EFFECTS.length), [propWalk, windage]);
});

test('format : options.fardage vaut true ou false, seul true est gardé', () => {
  const brut = rawSituation('libre-fardage');
  assert.deepEqual(parseSituation(brut).options, { fardage: true });
  assert.equal(parseSituation({ ...brut, options: { fardage: false } }).options, undefined);
  assert.deepEqual(parseSituation({ ...brut, options: { fardage: true, pasHelice: 'gauche' } }).options,
    { pasHelice: 'gauche', fardage: true });
  assert.throws(() => parseSituation({ ...brut, options: { fardage: 'oui' } }), SituationError);
  assert.throws(() => parseSituation({ ...brut, options: { fardage: 1 } }), SituationError);
});

test('éditeur : activer et retirer le fardage, sans toucher au pas d’hélice', () => {
  const sit = loadSituation('libre');
  const avec = reglerFardage(sit, true);
  assert.deepEqual(avec.options, { fardage: true });
  assert.equal(reglerFardage(avec, true), avec, 'rien ne change');
  const sans = reglerFardage(avec, false);
  assert.equal('options' in sans, false);
  assert.deepEqual(sans, sit);
  const deux = reglerPasHelice(avec, 'droite');
  assert.deepEqual(deux.options, { fardage: true, pasHelice: 'droite' });
  assert.deepEqual(reglerFardage(deux, false).options, { pasHelice: 'droite' });
  assert.deepEqual(reglerPasHelice(deux, null).options, { fardage: true });
});

test('relecture : une manœuvre avec fardage se rejoue à l’identique, côté tiré compris', () => {
  const scripted = (abattee: 1 | -1) => {
    const ses = new Session(buildState(loadSituation('libre-fardage'), undefined, abattee), DEFAULT_PARAMS);
    ses.advance(600);
    ses.act({ type: 'engine', value: -1 });
    ses.advance(400);
    ses.act({ type: 'rudder', value: 0.3 });
    ses.advance(300);
    return ses;
  };
  const ses = scripted(-1);
  const fin = JSON.stringify(ses.state);
  ses.seek(250);
  ses.seek(1300);
  assert.equal(JSON.stringify(ses.state), fin, 'retour arrière puis relecture');
  ses.seek(0);
  assert.equal(ses.state.options.windage, -1, '⏮ garde le côté tiré');
  assert.equal(JSON.stringify(scripted(-1).state), fin, 'même côté, même manœuvre');
  assert.notEqual(JSON.stringify(scripted(1).state), fin, 'l’autre côté donne une autre manœuvre');
});
