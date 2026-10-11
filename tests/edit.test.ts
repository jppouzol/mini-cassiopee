// Édition des aussières en préparation : nom déduit, ajout, suppression, plafond.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line, loadSituation, run } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import {
  EditionError, MOU_MOLLE, ajouterAussiere, basculerMou, nomDeduit, nomsAffiches,
  reglerPlafond, renommerAussiere, supprimerAussiere,
} from '../src/situations/edit.ts';
import { parseSituation, type Situation } from '../src/situations/schema.ts';
import { bitteDepuisMonde } from '../src/situations/quai.ts';

/** Situation de départ sur garde avant, sans aucune aussière. */
const vide = (): Situation => ({ ...loadSituation('depart-garde-avant'), aussieres: [] });
const tribord = (sit: Situation): Situation => ({ ...sit, bateau: { ...sit.bateau, bordAuQuai: 'tribord' } });

test('nom déduit : pointes, gardes et traversier avant', () => {
  const sit = vide();
  assert.equal(nomDeduit(sit, { taquet: 'etrave', bitte: 10 }), 'Pointe avant');
  assert.equal(nomDeduit(sit, { taquet: 'etrave', bitte: 8 }), 'Pointe avant');
  assert.equal(nomDeduit(sit, { taquet: 'etrave', bitte: 0 }), 'Garde avant');
  assert.equal(nomDeduit(sit, { taquet: 'etrave', bitte: -6 }), 'Garde avant');
  assert.equal(nomDeduit(sit, { taquet: 'etrave', bitte: 4 }), 'Traversier avant');
  assert.equal(nomDeduit(sit, { taquet: 'arriere', bitte: -10 }), 'Pointe arrière');
  assert.equal(nomDeduit(sit, { taquet: 'arriere', bitte: 0 }), 'Garde arrière');
  assert.equal(nomDeduit(sit, { taquet: 'arriere', bitte: 6 }), 'Garde arrière');
});

test('nom déduit : traversier sous 20° de la perpendiculaire', () => {
  // Bateau décalé de 4,75 m : la bitte monde 0 tombe juste au droit du taquet arrière.
  const sit = { ...vide(), bateau: { ...vide().bateau, x: 4.75 } };
  assert.equal(nomDeduit(sit, { taquet: 'arriere', bitte: -4.75 }), 'Traversier arrière');
  // À 2 m le long du bateau, l'aussière arrière est trop inclinée pour un traversier.
  assert.equal(nomDeduit(vide(), { taquet: 'arriere', bitte: -4 }), 'Garde arrière');
});

test('les noms du catalogue sont déduits correctement', () => {
  const sit = loadSituation('amarre-quatre-amarres');
  assert.deepEqual(nomsAffiches(sit), ['Pointe avant', 'Garde avant', 'Garde arrière', 'Pointe arrière']);
  assert.deepEqual(buildState(sit).lines.map((l) => l.name), nomsAffiches(sit));
});

test('nom déduit identique tribord au quai', () => {
  const sit = loadSituation('amarre-quatre-amarres');
  assert.deepEqual(nomsAffiches(tribord(sit)), nomsAffiches(sit));
});

test('les noms déduits identiques sont numérotés, un nom choisi est gardé', () => {
  let sit = ajouterAussiere(vide(), 'etrave', 0);
  sit = ajouterAussiere(sit, 'etrave', -2);
  sit = ajouterAussiere(sit, 'arriere', -10);
  assert.deepEqual(nomsAffiches(sit), ['Garde avant 1', 'Garde avant 2', 'Pointe arrière']);
  sit = renommerAussiere(sit, sit.aussieres[1].id, '  Garde longue  ');
  assert.deepEqual(nomsAffiches(sit), ['Garde avant', 'Garde longue', 'Pointe arrière']);
  sit = renommerAussiere(sit, sit.aussieres[1].id, '   ');
  assert.equal(sit.aussieres[1].nom, undefined, 'un nom vide rend le nom déduit');
});

test('ajout et suppression d’aussières', () => {
  let sit = ajouterAussiere(vide(), 'etrave', 0);
  sit = ajouterAussiere(sit, 'arriere', 0);
  assert.equal(sit.aussieres.length, 2);
  assert.notEqual(sit.aussieres[0].id, sit.aussieres[1].id);
  assert.equal(sit.aussieres[0].mou, 0, 'une aussière ajoutée est tendue');
  sit = supprimerAussiere(sit, sit.aussieres[0].id);
  assert.equal(sit.aussieres.length, 1);
  assert.equal(sit.aussieres[0].taquet, 'arriere');
  // Un nouvel ajout ne reprend pas un identifiant existant.
  sit = ajouterAussiere(sit, 'etrave', 2);
  assert.equal(new Set(sit.aussieres.map((a) => a.id)).size, 2);
  // La situation produite reste valide au format du catalogue.
  assert.deepEqual(parseSituation(JSON.parse(JSON.stringify(sit))), sit);
});

test('doublon, bitte hors rangée et plafond sont refusés', () => {
  const sit = ajouterAussiere(vide(), 'etrave', 0);
  assert.throws(() => ajouterAussiere(sit, 'etrave', 0), EditionError);
  assert.doesNotThrow(() => ajouterAussiere(sit, 'arriere', 0), 'même bitte, autre taquet');
  assert.throws(() => ajouterAussiere(sit, 'etrave', 1), EditionError);
  let plein = vide();
  for (const b of [-10, -8, -6, -4, -2, 0]) plein = ajouterAussiere(plein, 'arriere', b);
  assert.throws(() => ajouterAussiere(plein, 'etrave', 10), /Plafond atteint : 6/);
  plein = reglerPlafond(plein, 7);
  assert.doesNotThrow(() => ajouterAussiere(plein, 'etrave', 10));
});

test('plafond borné entre 6 et 12, jamais sous le nombre d’aussières', () => {
  let sit = vide();
  assert.equal(reglerPlafond(sit, 3).plafondAussieres, undefined, '6 est la valeur par défaut');
  assert.equal(reglerPlafond(sit, 20).plafondAussieres, 12);
  sit = reglerPlafond(sit, 9);
  for (const b of [-10, -8, -6, -4, -2, 0, 2, 4]) sit = ajouterAussiere(sit, 'etrave', b);
  assert.equal(reglerPlafond(sit, 6).plafondAussieres, 8);
  assert.throws(() => parseSituation({ ...sit, plafondAussieres: 7 }), /8 aussières pour un plafond de 7/);
  assert.throws(() => parseSituation({ ...vide(), plafondAussieres: 13 }), /plafondAussieres/);
});

test('basculer entre tendue et molle', () => {
  let sit = ajouterAussiere(vide(), 'etrave', 0);
  const id = sit.aussieres[0].id;
  const tendue = buildState(sit).lines[0].len;
  sit = basculerMou(sit, id);
  assert.equal(sit.aussieres[0].mou, MOU_MOLLE);
  assert.ok(Math.abs(buildState(sit).lines[0].len - tendue - MOU_MOLLE) < 1e-9);
  sit = basculerMou(sit, id);
  assert.equal(sit.aussieres[0].mou, 0);
});

test('une garde avant ajoutée dans l’éditeur se comporte comme celle du catalogue', () => {
  const catalogue = buildState(loadSituation('depart-garde-avant'));
  const ajoutee = buildState(ajouterAussiere(vide(), 'etrave', 0));
  catalogue.engine = 1;
  ajoutee.engine = 1;
  run(catalogue, 8);
  run(ajoutee, 8);
  assert.equal(ajoutee.body.th, catalogue.body.th);
  assert.equal(ajoutee.body.x, catalogue.body.x);
  assert.equal(ajoutee.lines[0].name, 'Garde avant');
  assert.ok(line(ajoutee, ajoutee.lines[0].id).tension > 500);
});

test('conversion des positions de bitte, bâbord et tribord au quai', () => {
  const sit = { ...vide(), bateau: { ...vide().bateau, x: 3 } };
  assert.equal(bitteDepuisMonde(sit, 4), 1);
  assert.equal(bitteDepuisMonde(tribord(sit), 4), -1);
});
