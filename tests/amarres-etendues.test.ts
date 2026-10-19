// Commande des amarres simplifiée ou étendue (#75) : crans, affichage étendu imposé,
// et chevron d'une aussière qui file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line, run, start } from './helpers.ts';
import { CRANS, amarresForcees, cranDe, cranVoisin, lireAmarresEtendues } from '../src/ui/amarres.ts';
import { fileEnCeMoment } from '../src/render/renderer.ts';

test('crans dans l’ordre de l’échelle, de Choquer à Bloquer', () => {
  assert.deepEqual([...CRANS], ['choquer', 'bloquer']);
});

test('cran lu d’après l’aussière', () => {
  assert.equal(cranDe({ payingOut: true }), 'choquer');
  assert.equal(cranDe({ payingOut: false }), 'bloquer');
});

test('cran suivant au clavier, borné aux extrémités', () => {
  assert.equal(cranVoisin('bloquer', -1), 'choquer', 'Maj + chiffre : vers Choquer');
  assert.equal(cranVoisin('choquer', -1), 'choquer');
  assert.equal(cranVoisin('choquer', 1), 'bloquer', 'Alt + chiffre : vers Bloquer');
  assert.equal(cranVoisin('bloquer', 1), 'bloquer');
});

test('affichage étendu imposé tant qu’une aussière non larguée file, libre sinon', () => {
  assert.equal(amarresForcees([]), false, 'sans aussière');
  assert.equal(amarresForcees([{ attached: true, payingOut: false }, { attached: true, payingOut: false }]), false);
  assert.equal(amarresForcees([{ attached: true, payingOut: false }, { attached: true, payingOut: true }]), true);
  assert.equal(amarresForcees([{ attached: false, payingOut: true }]), false, 'une aussière larguée ne compte pas');
});

test('affichage étendu imposé dès la préparation pour une aussière qui file au départ', () => {
  const s = start('depart-garde-avant');
  assert.equal(amarresForcees(s.lines), false);
  line(s, 'garde-av').payingOut = true;
  assert.equal(amarresForcees(s.lines), true);
});

test('sans stockage local, les amarres sont simplifiées', () => {
  assert.equal(lireAmarresEtendues(), false);
});

test('chevron : garde avant choquée en marche avant, il apparaît quand l’aussière s’allonge', () => {
  const s = start('depart-garde-avant');
  const garde = line(s, 'garde-av');
  garde.payingOut = true;
  assert.equal(fileEnCeMoment(s.body, garde), false, 'bateau arrêté au départ');
  s.engine = 1;
  run(s, 3);
  const l0 = garde.len;
  assert.equal(fileEnCeMoment(s.body, garde), true, 'le bateau avance, la garde file');
  run(s, 0.5);
  assert.ok(garde.len > l0, 'la garde s’est bien allongée');
});

test('chevron absent sur une aussière bloquée, larguée ou que le bateau ne tend pas', () => {
  // Bloquée : même manœuvre, la garde retient.
  const bloquee = start('depart-garde-avant');
  bloquee.engine = 1;
  run(bloquee, 3);
  assert.equal(fileEnCeMoment(bloquee.body, line(bloquee, 'garde-av')), false, 'bloquée');

  // Larguée.
  const larguee = start('depart-garde-avant');
  const g = line(larguee, 'garde-av');
  g.payingOut = true;
  larguee.engine = 1;
  run(larguee, 3);
  g.attached = false;
  assert.equal(fileEnCeMoment(larguee.body, g), false, 'larguée');

  // Molle : le bateau recule vers la bitte, l'aussière ne file pas.
  const molle = start('depart-garde-avant');
  const gm = line(molle, 'garde-av');
  gm.payingOut = true;
  molle.engine = -1;
  run(molle, 3);
  assert.equal(fileEnCeMoment(molle.body, gm), false, 'le bateau se rapproche de la bitte');

  // Bateau arrêté après avoir filé : la longueur ne change plus.
  const arret = start('depart-garde-avant');
  const ga = line(arret, 'garde-av');
  ga.payingOut = true;
  arret.engine = 1;
  run(arret, 3);
  arret.body.vx = 0; arret.body.vy = 0; arret.body.w = 0;
  assert.equal(fileEnCeMoment(arret.body, ga), false, 'bateau arrêté');
});
