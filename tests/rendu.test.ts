// Test de fumée du rendu : la scène se dessine sans erreur pour chaque situation du catalogue,
// en préparation comme en manœuvre, avec ou sans voisins, bateaux en face et options, zoomée
// ou dézoomée, sur téléphone comme sur PC. Le contexte 2D est factice : il accepte tous les
// appels et refuse toute coordonnée qui ne serait pas un nombre fini. On ne vérifie pas
// l'image, seulement que le dessin va au bout sans exception ni valeur aberrante.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE } from '../src/situations/catalogue.ts';
import { buildState } from '../src/situations/build.ts';
import { EditionError, reglerEnFace, reglerFardage, reglerPasHelice, reglerVoisin, taquetsProposes } from '../src/situations/edit.ts';
import { bittesAutresCatways, bittesDuPort, libre } from '../src/situations/quai.ts';
import { cotesVoisin, type Situation } from '../src/situations/schema.ts';
import { Session } from '../src/session/session.ts';
import { DEFAULT_PARAMS } from '../src/sim/params.ts';
import { render, type Palette, type View } from '../src/render/renderer.ts';
import type { Cadrage } from '../src/render/cadrage.ts';
import type { SimState } from '../src/sim/types.ts';

/** Contexte 2D factice : compte les appels et lève une erreur sur un argument numérique non fini. */
function contexteFactice(): { ctx: CanvasRenderingContext2D; appels: () => number } {
  let appels = 0;
  const proprietes: Record<string | symbol, unknown> = {};
  const ctx = new Proxy({}, {
    get(_, nom) {
      if (nom in proprietes) return proprietes[nom];
      return (...args: unknown[]) => {
        appels += 1;
        for (const a of args) {
          if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${String(nom)} appelé avec ${a}`);
        }
      };
    },
    set(_, nom, valeur) {
      if (typeof valeur === 'number' && !Number.isFinite(valeur)) throw new Error(`${String(nom)} = ${valeur}`);
      proprietes[nom] = valeur;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, appels: () => appels };
}

const PALETTE: Palette = {
  water: '#def', grid: '#cde', quay: '#ba9', quayEdge: '#765', bollard: '#333', hull: '#fff', hullEdge: '#123',
  accent: '#16a', taut: '#c41', slack: '#899', ink: '#123', muted: '#678', ghost: '#123', neighbor: '#eee', alert: '#d00',
};
const ECRANS = [{ width: 390, height: 420 }, { width: 1280, height: 740 }];
const CADRAGES: Cadrage[] = [{ k: 1, ox: 0, oy: 0 }, { k: 1 / 3, ox: 0, oy: 0 }, { k: 4, ox: 2, oy: -2 }];

/** Dessine l'état sur tous les écrans et cadrages ; renvoie le nombre d'appels au contexte. */
function dessiner(sit: Situation, s: Readonly<SimState>, initial: Readonly<SimState>, preparation: boolean): number {
  let total = 0;
  for (const ecran of ECRANS) {
    for (const cadrage of CADRAGES) {
      const { ctx, appels } = contexteFactice();
      const view: View = {
        ...ecran, dpr: 2, palette: PALETTE, labelFont: 'sans-serif',
        ghost: preparation ? null : initial.body, debug: !preparation,
        bollards: bittesDuPort(sit), otherBollards: bittesAutresCatways(sit),
        edition: preparation && !libre(sit) ? { cleats: taquetsProposes(sit), selected: 'etrave' } : null,
        cadrage,
      };
      render(ctx, s, view);
      assert.ok(appels() > 20, `${sit.id} : la scène n'a presque rien dessiné`);
      total += appels();
    }
  }
  return total;
}

/** Variantes d'une situation : telle quelle, avec tous ses voisins, bateaux en face et options. */
function variantes(sit: Situation): Situation[] {
  let riche = reglerFardage(reglerPasHelice(sit, 'droite'), true);
  for (const cote of cotesVoisin(sit.quai.type)) {
    try {
      riche = reglerVoisin(riche, sit, cote, cote === 'catway' || cote === 'large' ? sit.bateau.x - 5 : 1);
    } catch (e) {
      if (!(e instanceof EditionError)) throw e;
    }
  }
  if (sit.quai.type === 'perpendiculaire') riche = reglerEnFace(riche, sit, 'etroite');
  return [sit, riche];
}

test('rendu : chaque situation du catalogue se dessine, en préparation puis en manœuvre', () => {
  for (const origine of CATALOGUE) {
    for (const sit of variantes(origine)) {
      const ses = new Session(buildState(sit), DEFAULT_PARAMS);
      dessiner(sit, ses.state, ses.initialState, true);
      // Une manœuvre qui touche à tout : moteur, barre, coup de fouet, crans, largage, ralenti.
      ses.act({ type: 'engine', value: 1 });
      ses.act({ type: 'rudder', value: 0.5 });
      ses.advance(180);
      dessiner(sit, ses.state, ses.initialState, false);
      ses.act({ type: 'kick', value: -1 });
      const [premiere, seconde] = ses.state.lines;
      if (premiere) ses.act({ type: 'line-mode', lineId: premiere.id, value: 'choque' });
      if (seconde) ses.act({ type: 'line-mode', lineId: seconde.id, value: 'reprend' });
      ses.advance(60);
      dessiner(sit, ses.state, ses.initialState, false);
      for (const l of ses.state.lines) ses.act({ type: 'cast-off', lineId: l.id });
      ses.act({ type: 'engine', value: -0.5 });
      ses.act({ type: 'rudder', value: -0.6 });
      ses.advance(600);
      dessiner(sit, ses.state, ses.initialState, false);
    }
  }
});

test('rendu : le contexte factice refuse une coordonnée non finie', () => {
  const sit = CATALOGUE[0];
  const s = buildState(sit);
  s.body.x = Number.NaN;
  assert.throws(() => dessiner(sit, s, s, false), /NaN/);
});
