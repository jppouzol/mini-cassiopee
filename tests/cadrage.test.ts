// Cadrage de la scène : zoom à deux doigts ou à la molette, bornes, point visé immobile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSituation } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import { camera } from '../src/render/renderer.ts';
import {
  CADRAGE_DEFAUT, ZOOM_MAX, ZOOM_MIN, bornerCadrage, echelleDefaut, estDefaut, longueurEchelle, pincer, zoomerAutour,
  type Cadrage,
} from '../src/render/cadrage.ts';

/** Scène au format téléphone, puis PC. */
const TELEPHONE = { W: 390, H: 420 };
const PC = { W: 900, H: 700 };

const proche = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

/** Demi-largeur et demi-hauteur (m) du cadrage par défaut. */
const demi = (W: number, H: number) => [W / 2 / echelleDefaut(W, H), H / 2 / echelleDefaut(W, H)];

test('cadrage : zoom borné entre ×1/3 et ×4, sans décalage à ×1', () => {
  // Bornes fixées par la spécification (« Zoom ») : on les affirme, pas seulement les constantes.
  assert.ok(proche(ZOOM_MIN, 1 / 3), `zoom minimal ×${ZOOM_MIN}`);
  assert.equal(ZOOM_MAX, 4);
  for (const { W, H } of [TELEPHONE, PC]) {
    assert.deepEqual(bornerCadrage({ k: 1, ox: 5, oy: -5 }, W, H), CADRAGE_DEFAUT);
    assert.equal(bornerCadrage({ k: 0.1, ox: 0, oy: 0 }, W, H).k, ZOOM_MIN);
    assert.equal(bornerCadrage({ k: 9, ox: 0, oy: 0 }, W, H).k, ZOOM_MAX);
    assert.deepEqual(bornerCadrage({ k: Number.NaN, ox: 1, oy: 1 }, W, H), CADRAGE_DEFAUT);
    // Dézoomer depuis un zoom ×2 d'un facteur 2 revient au cadrage par défaut, quel que soit le point visé.
    assert.ok(estDefaut(zoomerAutour({ k: 2, ox: 1, oy: 1 }, W, H, 50, 60, 0.5)));
    assert.equal(zoomerAutour(CADRAGE_DEFAUT, W, H, 10, 10, 0.01).k, ZOOM_MIN);
  }
});

test('cadrage : zoomée, la vue reste dans le cadrage par défaut ; dézoomée, elle le contient', () => {
  for (const { W, H } of [TELEPHONE, PC]) {
    const [hw, hh] = demi(W, H);
    for (const k of [1.5, 2, ZOOM_MAX]) {
      const c = bornerCadrage({ k, ox: 1000, oy: -1000 }, W, H);
      // Bord droit et bord bas de la vue zoomée sur ceux du cadrage par défaut.
      assert.ok(proche(c.ox + hw / k, hw));
      assert.ok(proche(c.oy - hh / k, -hh));
    }
    for (const k of [0.8, ZOOM_MIN]) {
      const c = bornerCadrage({ k, ox: 1000, oy: -1000 }, W, H);
      // Bord gauche et bord haut du cadrage par défaut sur ceux de la vue dézoomée.
      assert.ok(proche(c.ox - hw / k, -hw));
      assert.ok(proche(c.oy + hh / k, hh));
    }
  }
});

test('cadrage : le point sous le pointeur reste en place quand on zoome', () => {
  const s = buildState(loadSituation('depart-garde-avant'));
  for (const { W, H } of [TELEPHONE, PC]) {
    // Zoomer vers un point de la vue garde la vue dans le cadrage par défaut : les bornes ne jouent pas.
    let c: Cadrage = CADRAGE_DEFAUT;
    for (const [px, py, f] of [[W * 0.9, H * 0.1, 1.6], [W * 0.2, H * 0.8, 1.5], [W * 0.5, H * 0.3, 1.3]]) {
      const avant = camera(s, W, H, c).toWorld(px, py);
      c = zoomerAutour(c, W, H, px, py, f);
      const apres = camera(s, W, H, c).toWorld(px, py);
      assert.ok(proche(avant[0], apres[0], 1e-6) && proche(avant[1], apres[1], 1e-6), `${avant} ≠ ${apres}`);
    }
    assert.ok(proche(c.k, 1.6 * 1.5 * 1.3));
    // Dézoomer autour du centre de la scène : le centre ne bouge pas, les bornes ne jouent pas.
    const centre = camera(s, W, H).toWorld(W / 2, H / 2);
    const large = zoomerAutour(CADRAGE_DEFAUT, W, H, W / 2, H / 2, 0.6);
    const vu = camera(s, W, H, large).toWorld(W / 2, H / 2);
    assert.ok(proche(large.k, 0.6) && proche(centre[0], vu[0], 1e-6) && proche(centre[1], vu[1], 1e-6));
  }
});

test('cadrage : le pincement zoome autour des doigts et les suit', () => {
  const s = buildState(loadSituation('depart-garde-avant'));
  const { W, H } = TELEPHONE;
  // Écarter les doigts autour du milieu de la scène : zoom ×2, centre inchangé.
  const z = pincer(CADRAGE_DEFAUT, W, H, { x: W / 2, y: H / 2, d: 80 }, { x: W / 2, y: H / 2, d: 160 });
  assert.ok(proche(z.k, 2) && proche(z.ox, 0) && proche(z.oy, 0));
  // Écarter les doigts autour d'un point : ce point reste sous les doigts.
  const cible = camera(s, W, H, CADRAGE_DEFAUT).toWorld(W * 0.6, H * 0.45);
  const z2 = pincer(CADRAGE_DEFAUT, W, H, { x: W * 0.6, y: H * 0.45, d: 100 }, { x: W * 0.6, y: H * 0.45, d: 200 });
  const vu = camera(s, W, H, z2).toWorld(W * 0.6, H * 0.45);
  assert.ok(proche(cible[0], vu[0], 1e-6) && proche(cible[1], vu[1], 1e-6));
  // Glisser les deux doigts sans les écarter : la vue suit les doigts, le zoom ne change pas.
  const avant = camera(s, W, H, z).toWorld(W / 2, H / 2);
  const z3 = pincer(z, W, H, { x: W / 2, y: H / 2, d: 120 }, { x: W / 2 + 30, y: H / 2 - 20, d: 120 });
  assert.equal(z3.k, z.k);
  const apres = camera(s, W, H, z3).toWorld(W / 2 + 30, H / 2 - 20);
  assert.ok(proche(avant[0], apres[0], 1e-6) && proche(avant[1], apres[1], 1e-6));
  // Au cadrage par défaut, glisser les doigts ne déplace rien.
  assert.deepEqual(pincer(CADRAGE_DEFAUT, W, H, { x: 100, y: 100, d: 50 }, { x: 180, y: 160, d: 50 }), CADRAGE_DEFAUT);
});

test('cadrage : le suivi du bateau est conservé quand on zoome', () => {
  const s = buildState(loadSituation('depart-garde-avant'));
  const { W, H } = TELEPHONE;
  const c: Cadrage = bornerCadrage({ k: 2, ox: 0.5, oy: -0.5 }, W, H);
  const loin = { ...s, body: { ...s.body, x: s.body.x + 30, y: s.body.y - 20 } };
  // Le décalage choisi s'ajoute au cadrage par défaut, qui suit le bateau.
  const d0 = camera(loin, W, H), d1 = camera(loin, W, H, c);
  assert.ok(proche(d1.cx - d0.cx, c.ox) && proche(d1.cy - d0.cy, c.oy));
  assert.ok(proche(d1.sc, 2 * d0.sc) && proche(d1.sc0, d0.sc0));
});

test('cadrage : l’échelle se raccourcit quand on zoome', () => {
  assert.equal(longueurEchelle(ZOOM_MIN), 10);
  assert.equal(longueurEchelle(0.7), 5);
  assert.equal(longueurEchelle(1), 5);
  assert.equal(longueurEchelle(2), 2);
  assert.equal(longueurEchelle(2.5), 2);
  assert.equal(longueurEchelle(3), 1);
  assert.equal(longueurEchelle(ZOOM_MAX), 1);
});
