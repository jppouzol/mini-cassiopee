// Pas d'hélice (#10) : effet optionnel, déclaré sous `options.pasHelice`. Hélice à droite,
// l'arrière part vers bâbord en marche arrière ; en marche avant, l'effet est léger et
// inverse. Maximal bateau arrêté, il faiblit avec l'erre : la barre reprend le dessus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deg, loadSituation, rawSituation, run, stern } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { reglerPasHelice } from '../src/situations/edit.ts';
import { SituationError, parseSituation, type SensHelice } from '../src/situations/schema.ts';
import { BASE_EFFECTS, activeEffects, propWalk } from '../src/sim/effects.ts';
import { cloneState, tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { Session } from '../src/session/session.ts';
import type { Engine, Forces, SimState } from '../src/sim/types.ts';

/** Barre à fond : le maximum proposé par l'interface. */
const BARRE_MAX = (35 * Math.PI) / 180;

/** Bateau libre à l'arrêt, avec ou sans pas d'hélice, moteur et barre réglés. */
function libre(sens: SensHelice | null, engine: Engine, rudder = 0): SimState {
  const s = buildState(reglerPasHelice(loadSituation('eau-libre-pas-helice'), sens));
  s.engine = engine;
  s.rudder = rudder;
  return s;
}

/** Position latérale de l'arrière par rapport à l'axe de départ, positive vers bâbord (cap 0 : bâbord vers +y). */
const arriereVersBabord = (s: SimState, y0: number) => stern(s)[1] - y0;

test('le scénario de référence active le pas d’hélice, hélice à droite', () => {
  const s = buildState(loadSituation('eau-libre-pas-helice'));
  assert.deepEqual(s.options, { propWalk: 'droite' });
  assert.ok(activeEffects(s).includes(propWalk));
});

test('recul depuis l’arrêt, barre au centre : hélice à droite, l’arrière part vers bâbord', () => {
  const s = libre('droite', -1);
  const y0 = s.body.y;
  run(s, 5);
  assert.ok(arriereVersBabord(s, y0) > 0.3, `arrière décalé de ${arriereVersBabord(s, y0).toFixed(2)} m`);
  assert.ok(deg(s.body.th) < -5, `cap ${deg(s.body.th).toFixed(1)}°`);
});

test('recul depuis l’arrêt : hélice à gauche, symétrique exact de l’hélice à droite', () => {
  const d = libre('droite', -1), g = libre('gauche', -1);
  const y0 = d.body.y;
  run(d, 8);
  run(g, 8);
  assert.ok(arriereVersBabord(g, y0) < -0.3, 'l’arrière part vers tribord');
  assert.ok(Math.abs(d.body.th + g.body.th) < 1e-9, 'caps opposés');
  assert.ok(Math.abs(d.body.x - g.body.x) < 1e-9, 'même recul');
  assert.ok(Math.abs(d.body.y - y0 + (g.body.y - y0)) < 1e-9, 'écarts latéraux opposés');
});

test('recul sans option : le bateau recule droit', () => {
  const s = libre(null, -1);
  run(s, 10);
  assert.equal(s.body.th, 0);
  assert.ok(s.body.x < -5, 'le bateau a reculé');
});

test('marche avant : effet de sens contraire et plus faible qu’en marche arrière', () => {
  const avant = libre('droite', 1), arriere = libre('droite', -1);
  run(avant, 5);
  run(arriere, 5);
  assert.ok(avant.body.th > 0, `cap en marche avant ${deg(avant.body.th).toFixed(2)}°`);
  assert.ok(Math.abs(avant.body.th) < Math.abs(arriere.body.th) / 3,
    `${deg(avant.body.th).toFixed(1)}° en avant contre ${deg(arriere.body.th).toFixed(1)}° en arrière`);
});

test('la poussée latérale faiblit quand l’erre augmente', () => {
  const laterale = (u: number) => {
    const s = libre('droite', -1);
    s.body.vx = u; // cap 0 : vitesse longitudinale
    const f: Forces = { fx: 0, fy: 0, m: 0 };
    propWalk(s, DEFAULT_PARAMS, f);
    return Math.abs(f.fy);
  };
  const arret = laterale(0), lent = laterale(-0.8), lance = laterale(-1.8);
  assert.ok(Math.abs(lent - arret / 2) < 1e-9, 'moitié moins à propWalkSpeed');
  assert.ok(lance < arret / 4, `${lance.toFixed(0)} N lancé contre ${arret.toFixed(0)} N à l’arrêt`);
});

test('marche arrière, barre à fond dès le départ : l’arrière part d’abord de côté, puis la barre reprend le dessus avec l’erre', () => {
  // Hélice à droite, le pas d'hélice fait abattre l'étrave vers tribord (cap négatif) ;
  // en marche arrière, une barre négative la fait venir vers bâbord.
  const s = libre('droite', -1, -BARRE_MAX);
  let capMin = 0;
  for (let i = 0; i < 20 * 60; i++) {
    tick(s, DEFAULT_PARAMS);
    capMin = Math.min(capMin, s.body.th);
  }
  assert.ok(deg(capMin) < -2, `l’arrière part d’abord de côté (${deg(capMin).toFixed(1)}°)`);
  assert.ok(deg(s.body.th) > 10, `puis le bateau tourne du côté de la barre (${deg(s.body.th).toFixed(1)}°)`);
});

test('sans option, la manœuvre est la même, image par image, qu’avec la liste du socle', () => {
  const a = libre(null, -1, BARRE_MAX / 2), b = cloneState(a);
  assert.equal(activeEffects(a), BASE_EFFECTS);
  for (let i = 0; i < 10 * 60; i++) {
    tick(a, DEFAULT_PARAMS);
    tick(b, DEFAULT_PARAMS, BASE_EFFECTS);
  }
  assert.deepEqual(a, b);
});

test('format : options.pasHelice vaut droite ou gauche, le reste est refusé', () => {
  const brut = rawSituation('eau-libre-pas-helice');
  assert.deepEqual(parseSituation({ ...brut, options: { pasHelice: 'gauche' } }).options, { pasHelice: 'gauche' });
  assert.equal(parseSituation({ ...brut, options: {} }).options, undefined);
  assert.equal(parseSituation({ ...brut, options: undefined }).options, undefined);
  assert.throws(() => parseSituation({ ...brut, options: { pasHelice: 'babord' } }), SituationError);
  assert.throws(() => parseSituation({ ...brut, options: { bisafran: true } }), SituationError);
  assert.throws(() => parseSituation({ ...brut, options: 'droite' }), SituationError);
});

test('éditeur : régler puis retirer le pas d’hélice', () => {
  const sit = loadSituation('eau-libre');
  const droite = reglerPasHelice(sit, 'droite');
  assert.deepEqual(droite.options, { pasHelice: 'droite' });
  assert.deepEqual(reglerPasHelice(droite, 'gauche').options, { pasHelice: 'gauche' });
  const aucun = reglerPasHelice(droite, null);
  assert.equal('options' in aucun, false);
  assert.deepEqual(aucun, sit);
  assert.deepEqual(buildState(aucun).options, {});
});

test('relecture : une manœuvre avec pas d’hélice se rejoue à l’identique', () => {
  const scripted = () => {
    const ses = new Session(buildState(loadSituation('eau-libre-pas-helice')), DEFAULT_PARAMS);
    ses.act({ type: 'engine', value: -1 });
    ses.advance(200);
    ses.act({ type: 'rudder', value: -BARRE_MAX });
    ses.advance(300);
    ses.act({ type: 'engine', value: 1 });
    ses.advance(150);
    return ses;
  };
  const ses = scripted();
  const fin = JSON.stringify(ses.state);
  ses.seek(130);
  const mid = JSON.stringify(ses.state);
  ses.seek(650);
  assert.equal(JSON.stringify(ses.state), fin);
  ses.seek(5);
  ses.seek(130);
  assert.equal(JSON.stringify(ses.state), mid);
  assert.equal(JSON.stringify(scripted().state), fin);
});
