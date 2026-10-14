import type { Neighbor, SimState, Vec, Wind } from '../sim/types.ts';
import { cleatPosition, toWorld } from '../sim/geometry.ts';
import { COTES_VOISIN, type Situation, type WindDirection } from './schema.ts';
import {
  DEMI_LARGEUR_CATWAY, LONGUEUR_CATWAY, X_CATWAY, axesCatways, bowSign, perpendiculaire, pointBitte, poseDepart, quaySide, xVoisin,
} from './quai.ts';
import { nomsAffiches } from './edit.ts';

export { BOLLARD_SETBACK, BOLLARD_SPACING } from './quai.ts';

const S2 = Math.SQRT1_2;

/**
 * Direction vers laquelle souffle le vent, en repère monde, d'après les repères du port.
 * Le long du quai, « avant » et « arrière » se rapportent au cap du bateau au départ.
 * En perpendiculaire, « catway » et « large » sont de part et d'autre du bateau,
 * « quai » et « chenal » à ses deux bouts.
 */
export function windVector(direction: WindDirection, sit: Situation): Vec {
  const fromQuay: Vec = [0, -1];
  const mix = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) * S2, (a[1] + b[1]) * S2];
  const opp = (a: Vec): Vec => [-a[0], -a[1]];
  if (perpendiculaire(sit)) {
    // Le vent du catway pousse le bateau vers le large : il souffle de l'axe du catway vers celui du bateau.
    const fromCatway: Vec = [Math.sign(poseDepart(sit).x - X_CATWAY), 0];
    const dirs: Record<string, Vec> = { catway: fromCatway, large: opp(fromCatway), quai: fromQuay, chenal: opp(fromQuay) };
    const [a, b] = direction.split('-');
    return b ? mix(dirs[a], dirs[b]) : dirs[a];
  }
  const sign = bowSign(sit);
  const fromAhead: Vec = [-sign, 0];
  const dirs: Record<string, Vec> = { quai: fromQuay, large: opp(fromQuay), avant: fromAhead, arriere: opp(fromAhead) };
  const [a, b] = direction.split('-');
  return b ? mix(dirs[a], dirs[b]) : dirs[a];
}

/** Construit l'état initial de la simulation à partir d'une situation validée. */
export function buildState(sit: Situation, windOverride?: Situation['vent']): SimState {
  const pose = poseDepart(sit);
  const side = quaySide(sit);
  const body = { x: pose.x, y: pose.y, th: pose.th, vx: 0, vy: 0, w: 0 };
  const names = nomsAffiches(sit);
  const lines = sit.aussieres.map((a, i) => {
    const cleat = cleatPosition(a.taquet, side);
    const bollard = pointBitte(sit, a);
    const cw = toWorld(body, cleat);
    const dist = Math.hypot(cw[0] - bollard[0], cw[1] - bollard[1]);
    return { id: a.id, name: names[i], cleat, bollard, len: dist + a.mou, attached: true, payingOut: a.file === true, tension: 0 };
  });
  const v = windOverride ?? sit.vent;
  const wind: Wind = { to: windVector(v.direction, sit), force: v.force };
  const neighbors: Neighbor[] = [];
  for (const cote of COTES_VOISIN) {
    const ecart = sit.voisins?.[cote];
    if (ecart !== undefined) neighbors.push({ id: cote, x: xVoisin(sit, cote, ecart), y: pose.y, th: pose.th, contacts: [] });
  }
  // Catway du bateau et second catway, côté large ; aucun le long du quai.
  const catways = axesCatways(sit).map((x) => ({ x, halfWidth: DEMI_LARGEUR_CATWAY, length: LONGUEUR_CATWAY }));
  return { frame: 0, body, lines, engine: 0, rudder: 0, wind, contacts: [], catways, neighbors, pivot: null };
}
