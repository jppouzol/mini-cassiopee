// Giration du bateau libre (#43) : un voilier de 10 m à quille aileron et safran suspendu
// fait demi-tour barre à fond en moins de 2 à 2,5 longueurs, et pivote sur sa coque :
// dans la moitié avant en marche avant, dans la moitié arrière en marche arrière.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, start } from './helpers.ts';
import { tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import type { Engine, SimState } from '../src/sim/types.ts';

const L = DEFAULT_PARAMS.L;
/** Barre à fond : le maximum proposé par l'interface. */
const BARRE_MAX = (35 * Math.PI) / 180;

/** Bateau libre, à l'arrêt, moteur et barre réglés. */
function libre(engine: Engine, rudder: number): SimState {
  const s = start('eau-libre');
  s.engine = engine;
  s.rudder = rudder;
  return s;
}

/** Vitesses en repère bateau : u longitudinale, v latérale. */
function vitesses(s: SimState): { u: number; v: number } {
  const b = s.body, c = Math.cos(b.th), sn = Math.sin(b.th);
  return { u: c * b.vx + sn * b.vy, v: -sn * b.vx + c * b.vy };
}

/** Giration en régime établi : diamètre (m) et point de pivot calculé, sans la borne de l'affichage. */
function regime(engine: Engine, rudder: number): { diametre: number; pivot: number } {
  const s = libre(engine, rudder);
  run(s, 60);
  const { v } = vitesses(s);
  return { diametre: (2 * Math.hypot(s.body.vx, s.body.vy)) / Math.abs(s.body.w), pivot: -v / s.body.w };
}

for (const [bord, signe] of [['bâbord', 1], ['tribord', -1]] as const) {
  test(`marche avant, barre à fond ${bord} : diamètre de 1,5 à 2,5 longueurs, pivot sur la coque dans la moitié avant`, () => {
    const { diametre, pivot } = regime(1, signe * BARRE_MAX);
    assert.ok(diametre > 1.5 * L && diametre < 2.5 * L, `diamètre ${(diametre / L).toFixed(2)} longueurs`);
    assert.ok(pivot > 0.5 && pivot < L / 2 - 0.5, `pivot à ${pivot.toFixed(2)} m du centre`);
  });

  test(`marche arrière, barre à fond ${bord} : pivot sur la coque dans la moitié arrière`, () => {
    const { diametre, pivot } = regime(-1, signe * BARRE_MAX);
    assert.ok(pivot < -0.5 && pivot > -L / 2 + 0.5, `pivot à ${pivot.toFixed(2)} m du centre`);
    assert.ok(diametre < 3 * L, `diamètre ${(diametre / L).toFixed(2)} longueurs`);
  });
}

test('demi-tour depuis l’arrêt, barre à fond en marche avant : moins de 20 m de décalage latéral', () => {
  const s = libre(1, BARRE_MAX);
  const y0 = s.body.y;
  let decalage = 0;
  for (let i = 0; i < 60 * 60 && Math.abs(s.body.th) < Math.PI; i++) {
    tick(s, DEFAULT_PARAMS);
    decalage = Math.max(decalage, Math.abs(s.body.y - y0));
  }
  assert.ok(Math.abs(s.body.th) >= Math.PI, 'le bateau a fait demi-tour');
  assert.ok(decalage < 20, `décalage latéral ${decalage.toFixed(1)} m`);
});

test('plus de barre, cercle plus serré', () => {
  const moitie = regime(1, BARRE_MAX / 2).diametre;
  const fond = regime(1, BARRE_MAX).diametre;
  assert.ok(fond < moitie * 0.8, `${fond.toFixed(1)} m à fond contre ${moitie.toFixed(1)} m à mi-course`);
});

test('en giration, l’affichage montre le pivot dans la moitié avant', () => {
  const s = libre(1, BARRE_MAX);
  run(s, 30);
  assert.ok(s.pivot !== null && s.pivot > 0.5 && s.pivot < L / 2, `pivot affiché ${s.pivot}`);
});

test('bateau arrêté : la dérive au vent ne dépend pas de la répartition de la résistance latérale', () => {
  const derive = (dragYCenter: number) => {
    const s = start('eau-libre', { direction: 'quai', force: 'soutenu' });
    for (let i = 0; i < 60 * 20; i++) tick(s, { ...DEFAULT_PARAMS, dragYCenter });
    return s.body.vy;
  };
  assert.ok(Math.abs(derive(0) - derive(1)) < 1e-9, 'même vitesse de dérive');
});
