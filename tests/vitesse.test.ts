// Vitesse de manœuvre (#44) : moteur en avant, le bateau libre plafonne vers 3 nœuds,
// l'allure d'une manœuvre de port ; le vent soutenu pèse face au moteur sans le dépasser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, start } from './helpers.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import type { Engine, SimState } from '../src/sim/types.ts';
import type { Situation } from '../src/situations/schema.ts';

const NOEUD = 1852 / 3600;

/** Bateau libre, loin du quai, moteur réglé, lancé assez longtemps pour atteindre sa vitesse limite. */
function lance(engine: Engine, vent?: Situation['vent']): SimState {
  const s = start('eau-libre', vent);
  s.engine = engine;
  run(s, 90);
  return s;
}

/** Vitesse longitudinale (m/s), positive vers l'avant. */
const erre = (s: SimState) => Math.cos(s.body.th) * s.body.vx + Math.sin(s.body.th) * s.body.vy;

test('sans vent, marche avant : vitesse limite d’une manœuvre de port, de 2,5 à 3,5 nœuds', () => {
  const v = erre(lance(1)) / NOEUD;
  assert.ok(v > 2.5 && v < 3.5, `${v.toFixed(2)} nœuds`);
});

test('sans vent, marche arrière : plus lent qu’en marche avant', () => {
  const avant = erre(lance(1)), arriere = -erre(lance(-1));
  assert.ok(arriere > 0 && arriere < avant, `${(arriere / NOEUD).toFixed(2)} nœuds en arrière`);
});

test('vent soutenu de face : le bateau avance encore en marche avant, moins vite', () => {
  const calme = erre(lance(1));
  const face = erre(lance(1, { direction: 'avant', force: 'soutenu' }));
  assert.ok(face > 0.5 && face < calme, `${(face / NOEUD).toFixed(2)} nœuds contre ${(calme / NOEUD).toFixed(2)}`);
});

test('vent soutenu par le travers : plus de la moitié de la poussée avant, sans la dépasser', () => {
  const p = DEFAULT_PARAMS;
  assert.ok(p.windSoutenu > p.thrustFwd / 2 && p.windSoutenu < p.thrustFwd);
  assert.ok(p.windFaible < p.windSoutenu);
});
