// Édition des aussières en préparation : nom déduit, ajout, suppression, plafond.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line, loadSituation, run } from './helpers.ts';
import { buildState } from '../src/situations/build.ts';
import {
  DEPLACEMENT_MAX, EditionError, MOU_MOLLE, ajouterAussiere, basculerMou, deplacerBateau,
  nomDeduit, nomsAffiches, reglerPlafond, renommerAussiere, supprimerAussiere, supprimerToutesAussieres, taquetsProposes,
} from '../src/situations/edit.ts';
import { parseSituation, type Situation } from '../src/situations/schema.ts';
import { bitteDepuisSupport, bitteVersSupport } from '../src/situations/quai.ts';

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

test('tout supprimer retire toutes les aussières, et rien d’autre', () => {
  const avant: Situation = { ...loadSituation('depart-garde-avant'), plafondAussieres: 8 };
  let sit = ajouterAussiere(avant, 'arriere', 0);
  sit = renommerAussiere(sit, sit.aussieres[0].id, 'Ma garde');
  assert.ok(sit.aussieres.length >= 2);
  const videe = supprimerToutesAussieres(sit);
  assert.deepEqual(videe.aussieres, []);
  assert.deepEqual({ ...videe, aussieres: sit.aussieres }, sit, 'le reste de la situation est inchangé');
  // Déjà vide : même situation, pas de nouvelle session.
  assert.equal(supprimerToutesAussieres(videe), videe);
  // La situation produite reste valide et l'état construit n'a aucune aussière.
  assert.deepEqual(parseSituation(JSON.parse(JSON.stringify(videe))), videe);
  assert.equal(buildState(videe).lines.length, 0);
  // On peut ensuite poser ses propres amarres, jusqu'au plafond conservé.
  const reposee = ajouterAussiere(videe, 'etrave', -4);
  assert.equal(reposee.aussieres.length, 1);
  assert.equal(reposee.plafondAussieres, 8);
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
  const ajoutee = buildState(ajouterAussiere(vide(), 'etrave', -4));
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
  assert.equal(bitteDepuisSupport(sit, 4), 1);
  assert.equal(bitteDepuisSupport(tribord(sit), 4), -1);
});

test('déplacer le bateau : les aussières restent sur leurs bittes, bâbord et tribord au quai', () => {
  for (const sit of [loadSituation('amarre-quatre-amarres'), tribord(loadSituation('amarre-quatre-amarres'))]) {
    const avant = sit.aussieres.map((a) => bitteVersSupport(sit, a.bitte));
    const moved = deplacerBateau(sit, sit, 2.5);
    assert.equal(moved.bateau.x, 2.5);
    assert.deepEqual(moved.aussieres.map((a) => bitteVersSupport(moved, a.bitte)), avant);
    assert.deepEqual(moved.aussieres.map((a) => a.mou), sit.aussieres.map((a) => a.mou), 'le mou est conservé');
    // La situation produite reste valide : toutes les bittes sont sur la rangée.
    assert.deepEqual(parseSituation(JSON.parse(JSON.stringify(moved))), moved);
  }
});

test('déplacer le bateau : pas de 0,5 m et bornes autour de la position d’origine', () => {
  const origine = loadSituation('depart-garde-avant');
  assert.equal(deplacerBateau(origine, origine, 1.3).bateau.x, 1.5);
  assert.equal(deplacerBateau(origine, origine, -0.2).bateau.x, 0);
  assert.equal(deplacerBateau(origine, origine, 0.1), origine, 'position inchangée : même situation');
  assert.equal(deplacerBateau(origine, origine, 50).bateau.x, DEPLACEMENT_MAX);
  assert.equal(deplacerBateau(origine, origine, -50).bateau.x, -DEPLACEMENT_MAX);
  // Les bornes se comptent depuis l'origine, pas depuis la position courante.
  const loin = deplacerBateau(origine, origine, 4);
  assert.equal(deplacerBateau(loin, origine, 4.5), loin);
});

test('déplacer le bateau : le nom déduit suit la géométrie, un nom choisi est gardé', () => {
  // Gardes courtes, tournées sur la bitte du milieu : les gardes croisées du catalogue restent des gardes à ±4 m.
  let sit = vide();
  for (const [taquet, bitte] of [['etrave', 10], ['etrave', 0], ['arriere', 0], ['arriere', -10]] as const) {
    sit = ajouterAussiere(sit, taquet, bitte);
  }
  sit = renommerAussiere(sit, sit.aussieres[3].id, 'Ma pointe');
  const moved = deplacerBateau(sit, sit, -4);
  // L'étrave arrive presque au droit de la bitte de la garde avant : elle devient traversier.
  assert.deepEqual(nomsAffiches(moved), ['Pointe avant', 'Traversier avant', 'Garde arrière', 'Ma pointe']);
});

test('déplacer le bateau : un traversier arrière devient possible', () => {
  const sit = deplacerBateau(vide(), vide(), 1);
  // Taquet arrière à x = -3,75 : la bitte -4 n'est qu'à 0,25 m le long du bateau.
  const avecTraversiers = ajouterAussiere(ajouterAussiere(sit, 'arriere', bitteDepuisSupport(sit, -4)), 'etrave', bitteDepuisSupport(sit, 6));
  assert.deepEqual(nomsAffiches(avecTraversiers), ['Traversier arrière', 'Traversier avant']);
});

test('bateau décalé de 2 m, mêmes aussières relatives : manœuvre identique (rangée périodique)', () => {
  // Décaler bateau et aussières d'un espacement de bittes ne change rien au problème posé.
  const sit = loadSituation('depart-garde-avant');
  const ref = buildState(sit);
  const decale = buildState({ ...sit, bateau: { ...sit.bateau, x: 2 } });
  ref.engine = 1;
  decale.engine = 1;
  run(ref, 8);
  run(decale, 8);
  assert.ok(Math.abs(decale.body.x - 2 - ref.body.x) < 1e-9);
  assert.ok(Math.abs(decale.body.y - ref.body.y) < 1e-9);
  assert.ok(Math.abs(decale.body.th - ref.body.th) < 1e-9);
  assert.ok(Math.abs(line(decale, 'garde-av').tension - line(ref, 'garde-av').tension) < 1e-3);
});

test('déplacer le bateau allonge une garde restée sur sa bitte', () => {
  // Glissé de 2 m vers l'avant, le taquet d'étrave s'éloigne de 2 m de la bitte de la garde.
  const sit = loadSituation('depart-garde-avant');
  const ref = buildState(sit);
  const moved = buildState(deplacerBateau(sit, sit, 2));
  assert.equal(moved.lines[0].name, 'Garde avant');
  assert.ok(moved.lines[0].len > ref.lines[0].len + 1.5);
});

test('nom par bord : deux aussières de même nom sur deux bords, sinon un numéro', () => {
  const garde = loadSituation('depart-garde-avant');
  const sit = { ...garde, aussieres: [] };
  // Le long du quai aussi, l'éditeur propose les taquets des deux bords, maître-bau compris.
  assert.deepEqual(taquetsProposes(sit).map((c) => c.name), ['etrave', 'etrave-large', 'maitre-bau', 'maitre-bau-large', 'arriere', 'arriere-large']);
  const deux = ajouterAussiere(ajouterAussiere(sit, 'arriere', -8), 'arriere-large', -10);
  assert.deepEqual(nomsAffiches(deux), ['Pointe arrière bâbord', 'Pointe arrière tribord']);
  assert.deepEqual(nomsAffiches({ ...deux, bateau: { ...deux.bateau, bordAuQuai: 'tribord' } }), ['Pointe arrière tribord', 'Pointe arrière bâbord']);
  // Deux pointes arrière du même bord : le bord ne suffit plus, elles sont numérotées.
  const meme = ajouterAussiere(deux, 'arriere', -10);
  assert.deepEqual(nomsAffiches(meme), ['Pointe arrière 1', 'Pointe arrière 2', 'Pointe arrière 3']);
  // Une aussière seule de son nom garde un nom sans bord.
  assert.deepEqual(nomsAffiches(ajouterAussiere(sit, 'arriere-large', -10)), ['Pointe arrière']);
});
