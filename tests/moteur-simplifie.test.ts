// Commande moteur simplifiée ou étendue (#73) : affichage étendu imposé et crans du clavier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGINE_POSITIONS } from '../src/sim/kick.ts';
import type { Engine } from '../src/sim/types.ts';
import { POSITIONS_SIMPLES, cranSuivant, etenduForce, lireMoteurEtendu, positionsClavier } from '../src/ui/moteur.ts';

test('commande simplifiée : arrière, neutre, avant, dans l’ordre de la commande étendue', () => {
  assert.deepEqual([...POSITIONS_SIMPLES], [-1, 0, 1]);
  assert.deepEqual([...POSITIONS_SIMPLES], ENGINE_POSITIONS.filter((p) => POSITIONS_SIMPLES.includes(p)));
});

test('affichage étendu imposé au ralenti et pendant un coup de fouet, libre sinon', () => {
  for (const engine of [-1, 0, 1] as Engine[]) assert.equal(etenduForce({ engine, kick: null }), false, `moteur ${engine}`);
  for (const engine of [-0.5, 0.5] as Engine[]) assert.equal(etenduForce({ engine, kick: null }), true, `ralenti ${engine}`);
  assert.equal(etenduForce({ engine: 0, kick: { dir: 1, frames: 10, brake: false } }), true);
  assert.equal(etenduForce({ engine: 1, kick: { dir: -1, frames: 0, brake: true } }), true);
});

test('crans du clavier : trois en simplifié, cinq en étendu', () => {
  assert.deepEqual(positionsClavier(false), POSITIONS_SIMPLES);
  assert.deepEqual(positionsClavier(true), ENGINE_POSITIONS);
  // Simplifié : du neutre, un cran mène à la marche, sans passer par le ralenti.
  assert.equal(cranSuivant(0, 1, false), 1);
  assert.equal(cranSuivant(0, -1, false), -1);
  assert.equal(cranSuivant(1, 1, false), 1);
  assert.equal(cranSuivant(-1, -1, false), -1);
  // Étendu : ralentis compris.
  assert.equal(cranSuivant(0, 1, true), 0.5);
  assert.equal(cranSuivant(0.5, 1, true), 1);
  assert.equal(cranSuivant(-0.5, -1, true), -1);
  // Depuis un ralenti en simplifié, la position la plus proche dans le sens demandé.
  assert.equal(cranSuivant(0.5, 1, false), 1);
  assert.equal(cranSuivant(0.5, -1, false), 0);
  assert.equal(cranSuivant(-0.5, 1, false), 0);
});

test('sans stockage local, la commande est simplifiée', () => {
  assert.equal(lireMoteurEtendu(), false);
});
