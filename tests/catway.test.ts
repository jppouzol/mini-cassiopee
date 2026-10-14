// Amarrage perpendiculaire le long d'un catway : format, géométrie, contact,
// scénarios du catalogue, nom déduit, déplacement dans l'éditeur, relecture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bow, catalogueFiles, deg, line, loadSituation, run, stern } from './helpers.ts';
import { buildState, windVector } from '../src/situations/build.ts';
import { cloneState, tick } from '../src/sim/engine.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { HULL, HALF_LENGTH, cleatPosition, toLocal, toWorld } from '../src/sim/geometry.ts';
import type { SimState, Vec } from '../src/sim/types.ts';
import { Session } from '../src/session/session.ts';
import {
  EditionError, ajouterAussiere, bornesDeplacement, deplacerBateau, nomDeduit, nomsAffiches, reglerVoisin, taquetsProposes,
} from '../src/situations/edit.ts';
import {
  ECART_QUAI_MIN, LONGUEUR_CATWAY, bitteDepuisPoint, bitteRepereBateau, bittesAutresCatways, bittesDuPort, pointBitte, quaySide,
} from '../src/situations/quai.ts';
import { parseSituation, type Situation } from '../src/situations/schema.ts';

const verification = (): Situation => loadSituation('catway-verification');
const sortieArriere = (): Situation => loadSituation('catway-sortie-arriere');
const sortieAvant = (): Situation => loadSituation('catway-sortie-avant');
const tribord = (sit: Situation): Situation => ({ ...sit, bateau: { ...sit.bateau, bordAuQuai: 'tribord' } });
const sansAmarre = (sit: Situation): Situation => ({ ...sit, aussieres: [] });
const avecVent = (sit: Situation, direction: Situation['vent']['direction'], force: Situation['vent']['force'] = 'soutenu'): Situation =>
  ({ ...sit, vent: { direction, force } });
const larguer = (s: SimState) => { for (const l of s.lines) l.attached = false; };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/** Plus grande pénétration de la coque dans les catways (m). */
function penetrationCatway(s: SimState): number {
  let m = 0;
  for (const c of s.catways) {
    for (const p of HULL) {
      const w = toWorld(s.body, p);
      if (Math.abs(w[0] - c.x) < c.halfWidth && w[1] < 0 && w[1] > -c.length) {
        m = Math.max(m, Math.min(c.halfWidth - Math.abs(w[0] - c.x), w[1] + c.length));
      }
    }
  }
  return m;
}

/** Simule image par image et renvoie le nombre d'images avec un appui et la pénétration maximale. */
function suivre(s: SimState, seconds: number): { appuis: number; penetration: number } {
  let appuis = 0, penetration = 0;
  for (let i = 0; i < seconds * 60; i++) {
    run(s, 1 / 60);
    if (s.contacts.length) appuis++;
    penetration = Math.max(penetration, penetrationCatway(s));
  }
  return { appuis, penetration };
}

test('format : situations du catalogue lues, catway en place', () => {
  for (const sit of [verification(), sortieArriere(), sortieAvant()]) {
    assert.equal(sit.quai.type, 'perpendiculaire');
    const s = buildState(sit);
    // Le catway du bateau, puis le second, côté large, à 8 m de bord à bord : deux places entre eux.
    assert.deepEqual(s.catways, [
      { x: 0, halfWidth: 0.5, length: LONGUEUR_CATWAY },
      { x: 9 * Math.sign(s.body.x), halfWidth: 0.5, length: LONGUEUR_CATWAY },
    ]);
    assert.ok(near(LONGUEUR_CATWAY, 6.67, 1e-9));
    assert.equal(penetrationCatway(s), 0);
    assert.ok(bow(s)[1] < 0 && stern(s)[1] < 0, 'le bateau est dans l’eau, sous le quai');
  }
  assert.deepEqual(buildState(loadSituation('depart-garde-avant')).catways, [], 'pas de catway le long du quai');
});

test('format : règles propres au catway', () => {
  const sit = sortieArriere();
  const json = (patch: Record<string, unknown>) => ({ ...sit, ...patch });
  const { boutAuQuai: _b, ...sansBout } = sit.bateau;
  assert.throws(() => parseSituation(json({ bateau: sansBout })), /boutAuQuai/);
  assert.throws(() => parseSituation(json({ bateau: { ...sit.bateau, x: HALF_LENGTH + 0.2 } })), /0.5 m au moins du quai/);
  const aussiere = (a: Record<string, unknown>) => json({ aussieres: [{ id: 'a', taquet: 'etrave', mou: 0, ...a }] });
  assert.throws(() => parseSituation(aussiere({ bitte: 1 })), /rangée de bittes du catway/);
  assert.throws(() => parseSituation(aussiere({ bitte: -2 })), /rangée de bittes du catway/, 'au-delà du bout du catway');
  assert.throws(() => parseSituation(aussiere({ bitte: 1, sur: 'quai' })), /rangée de bittes du quai/);
  assert.throws(() => parseSituation(aussiere({ bitte: 0.5, sur: 'catway' })), /sur/);
  assert.throws(() => parseSituation(json({ voisins: { avant: 1 } })), /le long du quai/);
  assert.throws(() => parseSituation(json({ vent: { direction: 'avant', force: 'faible' } })), /vent.direction/);
  // Le long du quai, les champs propres au catway sont refusés.
  const garde = loadSituation('depart-garde-avant');
  assert.throws(() => parseSituation({ ...garde, bateau: { ...garde.bateau, boutAuQuai: 'etrave' } }), /perpendiculaire/);
  assert.throws(() => parseSituation({ ...garde, aussieres: [{ id: 'a', taquet: 'etrave', bitte: 0, sur: 'quai', mou: 0 }] }), /perpendiculaire/);
  assert.throws(() => parseSituation({ ...garde, vent: { direction: 'chenal', force: 'faible' } }), /vent.direction/);
});

test('géométrie : bateau le long du catway, bittes sur leurs rangées, de part et d’autre du catway', () => {
  for (const sit of [sortieArriere(), tribord(sortieArriere()), sortieAvant(), tribord(sortieAvant())]) {
    const s = buildState(sit);
    // Flanc à distanceQuai du catway, bout au quai à bateau.x - 5 m du bord du quai.
    assert.ok(near(Math.abs(s.body.x) - 1.7 - 0.5, sit.bateau.distanceQuai, 1e-9));
    const boutAuQuai = sit.bateau.boutAuQuai === 'etrave' ? bow(s) : stern(s);
    assert.ok(near(-boutAuQuai[1], sit.bateau.x - HALF_LENGTH, 1e-9));
    // Le flanc choisi regarde le catway.
    const flanc = toWorld(s.body, [0, 1.7 * quaySide(sit)]);
    assert.ok(Math.abs(flanc[0]) < Math.abs(s.body.x));
    // Les bittes des aussières sont parmi celles qu'on dessine.
    const port = bittesDuPort(sit).map((p) => p.join(','));
    for (const l of s.lines) assert.ok(port.includes(l.bollard.join(',')), `${l.name} : bitte ${l.bollard}`);
    // Le repère bateau du nom déduit correspond à la géométrie réelle.
    for (const a of sit.aussieres) {
      const local = toLocal(s.body, pointBitte(sit, a));
      const attendu = bitteRepereBateau(sit, a);
      assert.ok(near(local[0], attendu[0], 1e-9) && near(local[1] * quaySide(sit), attendu[1], 1e-9), a.id);
      // Une bitte touchée dans l'éditeur redonne la même aussière.
      assert.deepEqual(bitteDepuisPoint(sit, pointBitte(sit, a)), a.sur ? { bitte: a.bitte, sur: 'quai' } : { bitte: a.bitte });
    }
  }
});

test('bittes : quai aligné sur les bords des catways puis tous les 2 m, deux bittes par catway', () => {
  for (const sit of [sortieArriere(), tribord(sortieArriere()), sortieAvant(), tribord(sortieAvant())]) {
    const s = buildState(sit);
    const cote = Math.sign(s.body.x);
    const quai = bittesDuPort(sit).filter((p) => p[1] > 0).map((p) => p[0] * cote).filter((x) => x > -4 && x < 14);
    // Bords du catway du bateau (±0,5), tous les 2 m jusqu'au second catway (8,5 et 9,5), puis tous les 2 m.
    assert.deepEqual(quai.sort((a, b) => a - b), [-2.5, -0.5, 0.5, 2.5, 4.5, 6.5, 8.5, 9.5, 11.5, 13.5]);
    // Seul le catway du bateau porte des bittes proposées : au milieu et près du bout.
    assert.deepEqual(bittesDuPort(sit).filter((p) => p[1] < 0), [[0, -3.3], [0, -6.4]]);
    assert.deepEqual(bittesAutresCatways(sit), [[9 * cote, -3.3], [9 * cote, -6.4]]);
  }
});

test('nom déduit sur catway : pointe vers le quai, gardes et traversier sur le catway, de part et d’autre', () => {
  // Deux pointes avant depuis le taquet d'étrave, départagées par le bord où se trouve leur bitte.
  assert.deepEqual(nomsAffiches(sortieArriere()), ['Pointe avant bâbord', 'Pointe avant tribord', 'Garde avant', 'Garde arrière']);
  assert.deepEqual(nomsAffiches(tribord(sortieArriere())), ['Pointe avant tribord', 'Pointe avant bâbord', 'Garde avant', 'Garde arrière']);
  for (const sit of [sortieArriere(), tribord(sortieArriere())]) {
    // Une bitte presque en face du taquet d’étrave, le long du catway, ferait un traversier.
    assert.equal(nomDeduit(sit, { taquet: 'etrave', bitte: 4.4 }), 'Traversier avant');
  }
  // Cul à quai : une pointe arrière depuis chaque taquet arrière.
  assert.deepEqual(nomsAffiches(verification()), ['Pointe arrière bâbord', 'Pointe arrière tribord', 'Garde arrière', 'Garde avant']);
  assert.deepEqual(nomsAffiches(tribord(verification())), ['Pointe arrière tribord', 'Pointe arrière bâbord', 'Garde arrière', 'Garde avant']);
});

test('vent en repères du port : catway, large, quai, chenal', () => {
  for (const sit of [sortieArriere(), tribord(sortieArriere()), sortieAvant(), tribord(sortieAvant())]) {
    const s = buildState(sit);
    // Le vent du catway souffle de l'axe du catway vers le bateau.
    const versBateau = Math.sign(s.body.x);
    const egal = (v: Vec, attendu: Vec) => assert.ok(near(v[0], attendu[0]) && near(v[1], attendu[1]), `${v} ≠ ${attendu}`);
    egal(windVector('catway', sit), [versBateau, 0]);
    egal(windVector('large', sit), [-versBateau, 0]);
    egal(windVector('quai', sit), [0, -1]);
    egal(windVector('chenal', sit), [0, 1]);
    egal(windVector('large-chenal', sit), [-versBateau * Math.SQRT1_2, Math.SQRT1_2]);
  }
});

test('catway en obstacle : sans amarre, le vent du large plaque le bateau sur le catway, symétrique de l’autre côté', () => {
  const fins: SimState[] = [];
  for (const sit of [sortieAvant(), tribord(sortieAvant())]) {
    const s = buildState(avecVent(sansAmarre(sit), 'large'));
    const x0 = s.body.x;
    const { appuis, penetration } = suivre(s, 20);
    assert.ok(appuis > 600, 'le bateau reste en appui sur le catway');
    assert.ok(penetration < 0.05, `pénétration ${penetration.toFixed(3)} m`);
    assert.ok(Math.abs(s.body.x) < Math.abs(x0), 'le bateau s’est rapproché du catway');
    assert.ok(Math.hypot(s.body.vx, s.body.vy) < 0.01, 'puis s’arrête');
    fins.push(s);
  }
  const [a, b] = fins;
  assert.ok(near(a.body.x, -b.body.x, 1e-6) && near(a.body.y, b.body.y, 1e-6), 'symétrique');
});

test('quai en bout : étrave au quai sans amarre, marche avant, le quai arrête l’étrave', () => {
  const s = buildState(sansAmarre(sortieArriere()));
  s.engine = 1;
  let maxY = -Infinity;
  for (let i = 0; i < 15 * 60; i++) { tick(s, DEFAULT_PARAMS); maxY = Math.max(maxY, bow(s)[1]); }
  assert.ok(maxY < 0.06, `étrave dans le quai : ${maxY.toFixed(3)} m`);
  assert.ok(s.contacts.length > 0, 'appui signalé');
  assert.ok(Math.abs(deg(s.body.th) - 90) < 2, 'le bateau reste dans l’axe');
});

test('catway, vérification d’amarrage : vent soutenu du catway, l’amarrage tient, l’avant bouge plus que l’arrière', () => {
  for (const sit of [verification(), tribord(verification())]) {
    const s = buildState(sit);
    const b0 = bow(s), s0 = stern(s);
    let avant = 0, arriere = 0;
    for (let i = 0; i < 30; i++) {
      run(s, 1);
      avant = Math.max(avant, Math.hypot(bow(s)[0] - b0[0], bow(s)[1] - b0[1]));
      arriere = Math.max(arriere, Math.hypot(stern(s)[0] - s0[0], stern(s)[1] - s0[1]));
    }
    assert.ok(avant < 1.5, `l'avant reste près de sa place (${avant.toFixed(2)} m)`);
    assert.ok(avant > arriere, 'l’avant, qui dépasse du catway, est le plus exposé');
    assert.ok(Math.hypot(s.body.vx, s.body.vy) < 0.01, 'le bateau s’immobilise');
    assert.ok(line(s, 'garde-av').tension > 300 && line(s, 'garde-ar').tension > 300, 'les gardes travaillent');
  }
});

test('sortie en marche arrière : étrave au quai, aussières larguées, le bateau recule le long du catway sans le toucher', () => {
  for (const sit of [sortieArriere(), tribord(sortieArriere())]) {
    const s = buildState(sit);
    larguer(s);
    s.engine = -1;
    const { appuis } = suivre(s, 20);
    assert.equal(appuis, 0);
    assert.ok(bow(s)[1] < -LONGUEUR_CATWAY - 5, 'l’étrave a dépassé le bout du catway');
    assert.ok(Math.abs(deg(s.body.th) - 90) < 3, 'en ligne droite');
  }
});

test('sortie en marche avant : arrière au quai, aussières larguées, le bateau sort vers le chenal sans toucher le catway', () => {
  for (const sit of [sortieAvant(), tribord(sortieAvant())]) {
    const s = buildState(sit);
    larguer(s);
    s.engine = 1;
    const { appuis } = suivre(s, 20);
    assert.equal(appuis, 0);
    assert.ok(stern(s)[1] < -LONGUEUR_CATWAY - 5, 'l’arrière a dépassé le bout du catway');
  }
});

test('éditeur : glisser le long du catway, arrêt à 0,5 m du quai, bittes inchangées', () => {
  for (const o of [sortieArriere(), tribord(sortieAvant())]) {
    const [lo, hi] = bornesDeplacement(o, o);
    assert.equal(lo, HALF_LENGTH + ECART_QUAI_MIN);
    assert.equal(hi, o.bateau.x + 4);
    const vise = deplacerBateau(o, o, 0);
    assert.equal(vise.bateau.x, HALF_LENGTH + ECART_QUAI_MIN);
    const recule = deplacerBateau(o, o, o.bateau.x + 2.2);
    assert.equal(recule.bateau.x, o.bateau.x + 2);
    for (const moved of [vise, recule]) {
      const s0 = buildState(o), s1 = buildState(moved);
      assert.deepEqual(s1.lines.map((l) => l.bollard), s0.lines.map((l) => l.bollard), 'bittes fixes en monde');
      assert.equal(s1.body.x, s0.body.x, 'l’axe du bateau ne bouge pas le long du quai');
      assert.equal(moved.aussieres.find((a) => a.sur === 'quai')!.bitte, o.aussieres.find((a) => a.sur === 'quai')!.bitte);
    }
  }
  // Reculé de 2 m, le taquet d'étrave arrive presque en face de la bitte de la garde avant : elle devient un traversier.
  const o = sortieArriere();
  assert.deepEqual(nomsAffiches(deplacerBateau(o, o, o.bateau.x + 2)),
    ['Pointe avant bâbord', 'Pointe avant tribord', 'Traversier avant', 'Garde arrière']);
});

test('éditeur : ajouter une aussière sur le catway ou sur le quai, voisins refusés', () => {
  const sit = sansAmarre(sortieArriere());
  const surCatway = bitteDepuisPoint(sit, [0, -3.3]);
  const surQuai = bitteDepuisPoint(sit, [2.5, 0.6]);
  const avec = ajouterAussiere(ajouterAussiere(sit, 'etrave', surCatway.bitte, surCatway.sur), 'etrave', surQuai.bitte, surQuai.sur);
  assert.deepEqual(nomsAffiches(avec), ['Garde avant', 'Pointe avant']);
  // Cul à quai : une pointe arrière depuis chaque taquet arrière, proposés tous deux par l'éditeur.
  const cul = sansAmarre(sortieAvant());
  assert.deepEqual(taquetsProposes(cul).map((c) => c.name), ['etrave', 'arriere', 'arriere-large']);
  const deux = ajouterAussiere(ajouterAussiere(cul, 'arriere', 2, 'quai'), 'arriere-large', -2, 'quai');
  assert.deepEqual(nomsAffiches(deux), ['Pointe arrière bâbord', 'Pointe arrière tribord']);
  assert.deepEqual(buildState(deux).lines.map((l) => l.bollard), [[-0.5, 0.6], [-4.5, 0.6]]);
  assert.deepEqual(buildState(avec).lines.map((l) => l.bollard), [[0, -3.3], [2.5, 0.6]]);
  assert.throws(() => ajouterAussiere(avec, 'etrave', surQuai.bitte, 'quai'), EditionError, 'doublon');
  assert.throws(() => ajouterAussiere(sit, 'etrave', 3), /catway/);
  assert.throws(() => ajouterAussiere(sit, 'etrave', 1.5, 'quai'), /quai/);
  assert.throws(() => reglerVoisin(sit, sit, 'avant', 1), /le long du quai/);
  // Une garde avant ajoutée dans l'éditeur se comporte comme celle du catalogue.
  const cat = buildState(sortieArriere());
  const ajoutee = buildState(ajouterAussiere(sit, 'etrave', 2.7));
  assert.deepEqual(ajoutee.lines[0].bollard, line(cat, 'garde-av').bollard);
  assert.deepEqual(ajoutee.lines[0].cleat, cleatPosition('etrave', 1));
  assert.ok(near(ajoutee.lines[0].len, line(cat, 'garde-av').len));
});

test('relecture : un appui sur le catway se rejoue à l’identique', () => {
  const s = buildState(avecVent(sansAmarre(sortieAvant()), 'large-chenal'));
  const ses = new Session(s, DEFAULT_PARAMS);
  ses.act({ type: 'engine', value: 1 });
  ses.advance(180);
  ses.act({ type: 'rudder', value: 0.4 });
  ses.advance(420);
  const fin = cloneState(ses.state);
  ses.seek(250);
  ses.seek(600);
  assert.deepEqual(ses.state, fin);
  // Et le contact a bien eu lieu pendant la manœuvre.
  let touche = false;
  for (let f = 0; f <= 600; f += 10) { ses.seek(f); if (ses.state.contacts.length) touche = true; }
  assert.ok(touche, 'le vent du large a plaqué le bateau sur le catway');
});


test('catalogue : chaque aussière part vers l’extérieur du bateau, du bord de son taquet', () => {
  for (const f of catalogueFiles()) {
    const sit = parseSituation(JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'situations', 'catalogue', f), 'utf8')));
    const s = buildState(sit);
    for (const l of s.lines) {
      // Écart latéral de la bitte, en repère bateau, compté du côté du taquet : au-delà du taquet.
      const cote = Math.abs(l.cleat[1]) < 0.5 ? Math.sign(toLocal(s.body, l.bollard)[1]) : Math.sign(l.cleat[1]);
      const lateral = cote * toLocal(s.body, l.bollard)[1];
      assert.ok(lateral > Math.abs(l.cleat[1]) + 0.3, `${sit.id}, ${l.name} : la bitte n'est pas à l'extérieur du taquet`);
    }
  }
});
