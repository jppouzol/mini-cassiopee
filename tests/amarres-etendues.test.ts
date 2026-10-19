// Commande des amarres simplifiée ou étendue (#75) : crans, affichage étendu imposé,
// et chevron d'une aussière qui file ou qu'on reprend (#22).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line, run, start } from './helpers.ts';
import { CRANS, MODE_DU_CRAN, amarresForcees, cranDe, cranVoisin, lireAmarresEtendues } from '../src/ui/amarres.ts';
import { sensDuBout } from '../src/render/renderer.ts';

test('crans dans l’ordre de l’échelle, de Choquer à Reprendre', () => {
  assert.deepEqual([...CRANS], ['choquer', 'bloquer', 'reprendre']);
  assert.deepEqual(CRANS.map((c) => MODE_DU_CRAN[c]), ['choque', 'bloque', 'reprend']);
});

test('cran lu d’après l’aussière', () => {
  assert.equal(cranDe({ mode: 'choque' }), 'choquer');
  assert.equal(cranDe({ mode: 'bloque' }), 'bloquer');
  assert.equal(cranDe({ mode: 'reprend' }), 'reprendre');
});

test('cran suivant au clavier, borné aux extrémités', () => {
  assert.equal(cranVoisin('bloquer', -1), 'choquer', 'Maj + chiffre : vers Choquer');
  assert.equal(cranVoisin('reprendre', -1), 'bloquer');
  assert.equal(cranVoisin('choquer', -1), 'choquer');
  assert.equal(cranVoisin('choquer', 1), 'bloquer', 'Alt + chiffre : vers Reprendre');
  assert.equal(cranVoisin('bloquer', 1), 'reprendre');
  assert.equal(cranVoisin('reprendre', 1), 'reprendre');
});

test('affichage étendu imposé tant qu’une aussière non larguée n’est pas bloquée, libre sinon', () => {
  assert.equal(amarresForcees([]), false, 'sans aussière');
  assert.equal(amarresForcees([{ attached: true, mode: 'bloque' }, { attached: true, mode: 'bloque' }]), false);
  assert.equal(amarresForcees([{ attached: true, mode: 'bloque' }, { attached: true, mode: 'choque' }]), true);
  assert.equal(amarresForcees([{ attached: true, mode: 'reprend' }]), true, 'une aussière reprise');
  assert.equal(amarresForcees([{ attached: false, mode: 'choque' }]), false, 'une aussière larguée ne compte pas');
});

test('affichage étendu imposé dès la préparation pour une aussière qui file au départ', () => {
  const s = start('depart-garde-avant');
  assert.equal(amarresForcees(s.lines), false);
  line(s, 'garde-av').mode = 'choque';
  assert.equal(amarresForcees(s.lines), true);
});

test('sans stockage local, les amarres sont simplifiées', () => {
  assert.equal(lireAmarresEtendues(), false);
});

test('chevron : garde avant choquée en marche avant, il apparaît quand l’aussière s’allonge', () => {
  const s = start('depart-garde-avant');
  const garde = line(s, 'garde-av');
  garde.mode = 'choque';
  assert.equal(sensDuBout(garde), null, 'bateau arrêté au départ');
  s.engine = 1;
  run(s, 3);
  const l0 = garde.len;
  assert.equal(sensDuBout(garde), 'file', 'le bateau avance, la garde file');
  run(s, 0.5);
  assert.ok(garde.len > l0, 'la garde s’est bien allongée');
});

test('chevron absent sur une aussière bloquée, larguée ou que le bateau ne tend pas', () => {
  // Bloquée : même manœuvre, la garde retient.
  const bloquee = start('depart-garde-avant');
  bloquee.engine = 1;
  run(bloquee, 3);
  assert.equal(sensDuBout(line(bloquee, 'garde-av')), null, 'bloquée');

  // Larguée.
  const larguee = start('depart-garde-avant');
  const g = line(larguee, 'garde-av');
  g.mode = 'choque';
  larguee.engine = 1;
  run(larguee, 3);
  g.attached = false;
  assert.equal(sensDuBout(g), null, 'larguée');

  // Molle : le bateau recule vers la bitte, l'aussière ne file pas.
  const molle = start('depart-garde-avant');
  const gm = line(molle, 'garde-av');
  gm.mode = 'choque';
  molle.engine = -1;
  run(molle, 3);
  assert.equal(sensDuBout(gm), null, 'le bateau se rapproche de la bitte');

  // Bloquée après avoir filé : la longueur ne change plus.
  const arret = start('depart-garde-avant');
  const ga = line(arret, 'garde-av');
  ga.mode = 'choque';
  arret.engine = 1;
  run(arret, 3);
  ga.mode = 'bloque';
  run(arret, 1 / 60);
  assert.equal(sensDuBout(ga), null, 'bloquée après avoir filé');
});
