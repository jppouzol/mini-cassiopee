// Règles du catalogue : ce qu'il contient évolue librement, mais chaque situation doit les
// respecter. Les tests lisent le catalogue tel que le menu le présente (`GROUPES`), et
// vérifient qu'il contient exactement les fichiers du dossier catalogue/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fichiersCatalogue, rawSituation } from './helpers.ts';
import { CATALOGUE, GROUPES, grouper } from '../src/situations/catalogue.ts';
import { TYPES_QUAI } from '../src/situations/schema.ts';
import { BOLLARD_SPACING, buildState } from '../src/situations/build.ts';
import { bittesDuPort } from '../src/situations/quai.ts';
import { ECARTS_VOISIN, alleeEnFace, ecartVoisin, etraveVoisinCatway, nomDeduit } from '../src/situations/edit.ts';
import { tick } from '../src/sim/engine.ts';
import { toLocal } from '../src/sim/geometry.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';

test('menu : chaque fichier du dossier catalogue figure une fois dans les groupes, et rien d’autre', () => {
  const fichiers = fichiersCatalogue().map(({ sit }) => sit.id).sort();
  const menu = CATALOGUE.map((sit) => sit.id);
  assert.equal(new Set(menu).size, menu.length, 'situation en double dans le menu');
  assert.deepEqual([...menu].sort(), fichiers);
});

test('menu : chaque famille a au moins une situation, et chaque situation est dans un groupe de sa famille', () => {
  for (const type of TYPES_QUAI) {
    // Le bouton de la famille ouvre sa première situation : il en faut une.
    assert.ok(CATALOGUE.some((sit) => sit.quai.type === type), `famille ${type} sans situation`);
  }
  for (const g of GROUPES) {
    assert.ok(g.situations.length > 0, `groupe ${g.titre} (${g.type}) vide`);
    for (const sit of g.situations) assert.equal(sit.quai.type, g.type, `${sit.id} rangée dans le groupe ${g.titre} (${g.type})`);
  }
});

test('menu : une situation rangée dans le groupe d’une autre famille est refusée', () => {
  const libre = rawSituation('libre');
  assert.throws(() => grouper([{ type: 'long-side', titre: 'Départs', situations: [libre] }]), /n'est pas du type long-side/);
  assert.equal(grouper([{ type: 'libre', titre: 'Manœuvres', situations: [libre] }])[0].situations[0].id, 'libre');
});

test('toutes les situations du catalogue se construisent', () => {
  for (const sit of CATALOGUE) assert.equal(buildState(sit).lines.length, sit.aussieres.length, sit.id);
});

test('les bittes du catalogue sont sur la rangée du quai, ou sur le catway en perpendiculaire', () => {
  for (const sit of CATALOGUE) {
    const port = bittesDuPort(sit).map((p) => p.join(','));
    for (const l of buildState(sit).lines) {
      assert.ok(port.includes(l.bollard.join(',')), `${sit.id} : bitte en ${l.bollard}`);
      if (sit.quai.type === 'long-side') {
        const k = l.bollard[0] / BOLLARD_SPACING;
        assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `${sit.id} : bitte à x = ${l.bollard[0]}`);
      }
    }
  }
});

test('catalogue : chaque aussière part vers l’extérieur du bateau, du bord de son taquet', () => {
  for (const sit of CATALOGUE) {
    const s = buildState(sit);
    for (const l of s.lines) {
      // Écart latéral de la bitte, en repère bateau, compté du côté du taquet : au-delà du taquet.
      const cote = Math.sign(l.cleat[1]);
      const lateral = cote * toLocal(s.body, l.bollard)[1];
      assert.ok(lateral > Math.abs(l.cleat[1]) + 0.3, `${sit.id}, ${l.name} : la bitte n'est pas à l'extérieur du taquet`);
    }
  }
});

test('catalogue, le long du quai : les gardes sont croisées, tournées au niveau de l’autre moitié du bateau', () => {
  for (const sit of CATALOGUE) {
    if (sit.quai.type !== 'long-side') continue;
    for (const a of sit.aussieres) {
      const nom = nomDeduit(sit, a);
      // Bitte relative au milieu du bateau, positive vers l'avant ; la coque va de -5 à +5 m.
      if (nom.startsWith('Garde avant')) {
        assert.ok(a.bitte < 0 && a.bitte >= -5, `${sit.id} : garde avant tournée en ${a.bitte} m, hors de la moitié arrière`);
      } else if (nom.startsWith('Garde arrière')) {
        assert.ok(a.bitte > 0 && a.bitte <= 5, `${sit.id} : garde arrière tournée en ${a.bitte} m, hors de la moitié avant`);
      }
    }
  }
});

test('catalogue : chaque voisin correspond à un choix de l’éditeur et ne touche pas le bateau au départ', () => {
  for (const sit of CATALOGUE) {
    for (const cote of Object.keys(sit.voisins ?? {}) as (keyof NonNullable<typeof sit.voisins>)[]) {
      // L'éditeur montre ainsi le réglage du catalogue comme un choix sélectionné.
      const ecart = ecartVoisin(sit, sit, cote);
      const choix = cote === 'catway' || cote === 'large'
        ? [etraveVoisinCatway(sit)]
        : [ECARTS_VOISIN.serre, ECARTS_VOISIN.large];
      assert.ok(choix.includes(ecart as number), `${sit.id}, voisin ${cote} : écart ${ecart} hors des choix de l’éditeur`);
    }
    // Sans commande ni vent du catalogue, une seconde : aucun contact avec un voisin.
    const s = buildState(sit);
    for (let i = 0; i < 60; i++) tick(s, DEFAULT_PARAMS);
    assert.ok(s.neighbors.every((n) => n.contacts.length === 0), `${sit.id} : contact avec un voisin dès le départ`);
  }
});

test('catalogue : des bateaux en face correspondent à un choix d’allée de l’éditeur', () => {
  for (const sit of CATALOGUE) {
    if (sit.enFace === undefined) continue;
    // L'éditeur montre ainsi l'allée du catalogue comme un choix sélectionné (étroite ou large).
    assert.notEqual(alleeEnFace(sit, sit), null, `${sit.id} : allée de ${sit.enFace} m hors des choix de l’éditeur`);
  }
});

test('catalogue : les situations libres sont toutes sans aussière', () => {
  for (const sit of CATALOGUE) if (sit.quai.type === 'libre') assert.deepEqual(sit.aussieres, [], sit.id);
});
