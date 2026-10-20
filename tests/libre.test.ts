// Situation libre (#57) : le bateau seul en milieu de port, sans quai, aussière ni voisin.
// Le vent se rapporte au bateau au départ ; la caméra reste fixe tant que le bateau est dans le cadre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSituation, rawSituation, run, start } from './helpers.ts';
import { parseSituation } from '../src/situations/schema.ts';
import { buildState } from '../src/situations/build.ts';
import { bittesDuPort, bittesQuai } from '../src/situations/quai.ts';
import {
  EditionError, ajouterAussiere, bornesDeplacement, changerBord, deplacerBateau, reglerPasHelice, reglerVoisin, taquetsProposes,
} from '../src/situations/edit.ts';
import { Session } from '../src/session/session.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { MARGE_LIBRE, camera } from '../src/render/renderer.ts';
import { echelleDefaut } from '../src/render/cadrage.ts';

const avec = (modif: Record<string, unknown>) => ({ ...rawSituation('libre'), ...modif });
const refuse = (raw: unknown, motif: RegExp) => assert.throws(() => parseSituation(raw), motif);

test('format libre : ni bateau, ni aussière, ni voisin, ni plafond ; vent par rapport au bateau', () => {
  const sit = loadSituation('libre');
  assert.equal(sit.quai.type, 'libre');
  assert.deepEqual(sit.aussieres, []);
  refuse(avec({ bateau: { x: 0, distanceQuai: 0.05, bordAuQuai: 'babord' } }), /bateau/);
  refuse(avec({ aussieres: [{ id: 'a', taquet: 'etrave', bitte: 0, mou: 0 }] }), /liste vide/);
  refuse(avec({ voisins: {} }), /voisins/);
  refuse(avec({ plafondAussieres: 8 }), /plafondAussieres/);
  refuse(avec({ vent: { direction: 'quai', force: 'faible' } }), /vent\.direction/);
  for (const direction of ['avant', 'tribord', 'arriere-babord']) {
    assert.equal(parseSituation(avec({ vent: { direction, force: 'faible' } })).vent.direction, direction);
  }
  assert.equal(parseSituation(avec({ options: { pasHelice: 'gauche' } })).options?.pasHelice, 'gauche');
  // Les repères du bateau seul ne valent pas le long du quai.
  refuse({ ...rawSituation('eau-libre'), vent: { direction: 'babord', force: 'faible' } }, /vent\.direction/);
});

test('libre : bateau à l’origine, étrave vers le haut, ni quai, ni bitte, ni catway', () => {
  const sit = loadSituation('libre');
  const s = buildState(sit);
  assert.equal(s.quay, false);
  assert.deepEqual([s.body.x, s.body.y, s.body.th], [0, 0, Math.PI / 2]);
  assert.deepEqual([s.lines, s.catways, s.neighbors], [[], [], []]);
  assert.deepEqual(bittesDuPort(sit), []);
  assert.deepEqual(bittesQuai(sit), []);
  assert.equal(buildState(loadSituation('eau-libre')).quay, true);
});

test('libre, sans vent ni commande : le bateau ne bouge pas', () => {
  const s = start('libre');
  run(s, 20);
  assert.ok(Math.hypot(s.body.x, s.body.y) < 1e-9);
  assert.ok(Math.abs(s.body.th - Math.PI / 2) < 1e-9);
});

test('libre : rien à toucher, le bateau passe là où serait le bord du quai', () => {
  const s = start('libre');
  s.engine = 1;
  for (let i = 0; i < 30 * 60; i++) {
    run(s, 1 / 60);
    assert.equal(s.contacts.length, 0, `appui à l’image ${s.frame}`);
  }
  assert.ok(s.body.y > 20, `le bateau a avancé de ${s.body.y.toFixed(1)} m`);
  assert.ok(Math.abs(s.body.x) < 1e-6, 'barre au centre, il avance droit');
});

test('libre : vent de l’avant, le bateau recule droit ; de bâbord, il dérive vers tribord', () => {
  const sit = loadSituation('libre');
  const avant = buildState(sit, { direction: 'avant', force: 'soutenu' });
  run(avant, 20);
  assert.ok(avant.body.y < -1, `recul de ${(-avant.body.y).toFixed(2)} m`);
  assert.ok(Math.abs(avant.body.x) < 1e-6 && Math.abs(avant.body.th - Math.PI / 2) < 1e-6);
  // Étrave vers le haut, bâbord est à gauche à l'écran (x < 0) : le vent pousse vers la droite.
  const babord = buildState(sit, { direction: 'babord', force: 'soutenu' });
  run(babord, 20);
  assert.ok(babord.body.x > 1, `dérive de ${babord.body.x.toFixed(2)} m`);
  const tribord = buildState(sit, { direction: 'tribord', force: 'soutenu' });
  run(tribord, 20);
  assert.ok(Math.abs(tribord.body.x + babord.body.x) < 1e-6, 'symétrique de bâbord');
});

test('éditeur en libre : ni taquet, ni aussière, ni bord, ni voisin ; vent et pas d’hélice réglables', () => {
  const sit = loadSituation('libre');
  assert.deepEqual(taquetsProposes(sit), []);
  assert.throws(() => ajouterAussiere(sit, 'etrave', 0), EditionError);
  assert.throws(() => changerBord(sit, sit, 'tribord'), EditionError);
  assert.throws(() => reglerVoisin(sit, sit, 'avant', 1), EditionError);
  assert.equal(deplacerBateau(sit, sit, 3), sit);
  assert.deepEqual(bornesDeplacement(sit, sit), [sit.bateau.x, sit.bateau.x]);
  const helice = reglerPasHelice(sit, 'droite');
  assert.equal(buildState(helice).options.propWalk, 'droite');
  const to = buildState({ ...sit, vent: { direction: 'tribord', force: 'faible' } }).wind.to;
  assert.ok(Math.abs(to[0] + 1) < 1e-9 && Math.abs(to[1]) < 1e-9, 'vent de tribord : il souffle vers la gauche de l’écran');
});

test('caméra en libre : vue fixe tant que le bateau reste dans la marge, recalée au-delà', () => {
  for (const [W, H] of [[390, 420], [900, 700]]) {
    const s = start('libre');
    const sc = echelleDefaut(W, H);
    const lx = W / 2 / sc - MARGE_LIBRE, ly = H / 2 / sc - MARGE_LIBRE;
    const cam0 = camera(s, W, H);
    assert.equal(cam0.X(0), W / 2);
    assert.equal(cam0.Y(0), H / 2);
    // Dans la marge : la vue ne bouge pas.
    s.body.x = lx * 0.9; s.body.y = -ly * 0.9;
    assert.equal(camera(s, W, H).X(0), W / 2);
    assert.equal(camera(s, W, H).Y(0), H / 2);
    // Au-delà : le bateau reste au bord de la marge, entier à l'écran.
    for (const [x, y] of [[40, 0], [-40, 0], [0, 40], [0, -40], [30, -30]]) {
      s.body.x = x; s.body.y = y;
      const cam = camera(s, W, H);
      assert.ok(Math.abs(cam.X(x) - W / 2) <= lx * sc + 1e-6, `bateau en (${x}, ${y})`);
      assert.ok(Math.abs(cam.Y(y) - H / 2) <= ly * sc + 1e-6, `bateau en (${x}, ${y})`);
      assert.ok(cam.X(x) > 0 && cam.X(x) < W && cam.Y(y) > 0 && cam.Y(y) < H);
    }
  }
});

test('libre : une manœuvre se rejoue à l’identique après un retour arrière', () => {
  const ses = new Session(start('libre'), DEFAULT_PARAMS);
  ses.act({ type: 'engine', value: 1 });
  ses.act({ type: 'rudder', value: 0.6 });
  ses.advance(400);
  ses.act({ type: 'engine', value: -1 });
  ses.advance(400);
  const fin = JSON.stringify(ses.state);
  ses.seek(137);
  ses.seek(800);
  assert.equal(JSON.stringify(ses.state), fin);
});

