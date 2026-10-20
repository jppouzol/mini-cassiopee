import type { Catway, MooringLine, Neighbor, Panne, SimState, Vec, Wind } from '../sim/types.ts';
import { cleatPosition, toWorld } from '../sim/geometry.ts';
import { cotesVoisin, type Situation, type WindDirection } from './schema.ts';
import {
  DEMI_LARGEUR_CATWAY, LONGUEUR_CATWAY, X_CATWAY, axesCatways, bowSign, geometrieEnFace, libre, perpendiculaire, pointBitte, poseDepart, poseVoisin, quaySide,
} from './quai.ts';
import { nomsAffiches } from './edit.ts';

export { BOLLARD_SETBACK, BOLLARD_SPACING } from './quai.ts';

const S2 = Math.SQRT1_2;

/**
 * Direction vers laquelle souffle le vent, en repère monde, d'après les repères du port.
 * Le long du quai, « avant » et « arrière » se rapportent au cap du bateau au départ.
 * En perpendiculaire, « catway » et « large » sont de part et d'autre du bateau,
 * « quai » et « chenal » à ses deux bouts. En situation libre, les repères sont ceux du
 * bateau au départ : de l'avant, de l'arrière, de bâbord, de tribord.
 */
export function windVector(direction: WindDirection, sit: Situation): Vec {
  const fromQuay: Vec = [0, -1];
  const mix = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) * S2, (a[1] + b[1]) * S2];
  const opp = (a: Vec): Vec => [-a[0], -a[1]];
  if (libre(sit)) {
    // Vent de l'avant : il souffle de l'étrave vers l'arrière ; de bâbord, vers tribord.
    const th = poseDepart(sit).th;
    const fromAhead: Vec = [-Math.cos(th), -Math.sin(th)];
    const fromPort: Vec = [Math.sin(th), -Math.cos(th)];
    const dirs: Record<string, Vec> = { avant: fromAhead, arriere: opp(fromAhead), babord: fromPort, tribord: opp(fromPort) };
    const [a, b] = direction.split('-');
    return b ? mix(dirs[a], dirs[b]) : dirs[a];
  }
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

/**
 * Construit l'état initial de la simulation à partir d'une situation validée.
 * `abattee` est le côté où l'avant abat sous l'effet du fardage quand rien d'autre
 * n'en décide (1 vers bâbord, -1 vers tribord) : l'interface le tire à chaque
 * préparation ; il est noté dans l'état et rejoué à l'identique.
 */
export function buildState(sit: Situation, windOverride?: Situation['vent'], abattee: 1 | -1 = 1): SimState {
  const pose = poseDepart(sit);
  const side = quaySide(sit);
  const body = { x: pose.x, y: pose.y, th: pose.th, vx: 0, vy: 0, w: 0 };
  const names = nomsAffiches(sit);
  const lines = sit.aussieres.map((a, i): MooringLine => {
    const cleat = cleatPosition(a.taquet, side);
    const bollard = pointBitte(sit, a);
    const cw = toWorld(body, cleat);
    const dist = Math.hypot(cw[0] - bollard[0], cw[1] - bollard[1]);
    return { id: a.id, name: names[i], cleat, bollard, len: dist + a.mou, attached: true, mode: a.equipier ?? 'bloque', tension: 0, load: 0, rate: 0 };
  });
  const v = windOverride ?? sit.vent;
  const wind: Wind = { to: windVector(v.direction, sit), force: v.force };
  const neighbors: Neighbor[] = [];
  for (const cote of cotesVoisin(sit.quai.type)) {
    const valeur = sit.voisins?.[cote];
    if (valeur !== undefined) neighbors.push({ id: cote, ...poseVoisin(sit, cote, valeur), contacts: [] });
  }
  // Catway du bateau et second catway, côté large, descendant du quai ; aucun le long du quai.
  const catways: Catway[] = axesCatways(sit).map((x) => ({ x, halfWidth: DEMI_LARGEUR_CATWAY, length: LONGUEUR_CATWAY, y: 0, dir: -1 }));
  // Bateaux en face, de l'autre côté de l'allée : panne, catways tournés vers l'allée, et
  // quatre bateaux immobiles, traités comme des voisins.
  const pannes: Panne[] = [];
  const face = geometrieEnFace(sit);
  if (face) {
    pannes.push({ ...face.panne });
    catways.push(...face.catways);
    face.bateaux.forEach((pose, i) => neighbors.push({ id: `face-${i + 1}`, ...pose, contacts: [] }));
  }
  // Effets avancés : seuls ceux que la situation active.
  const options: SimState['options'] = {};
  if (sit.options?.pasHelice) options.propWalk = sit.options.pasHelice;
  if (sit.options?.fardage) options.windage = abattee;
  // Sans quai en situation libre : rien à toucher.
  return { frame: 0, body, lines, engine: 0, kick: null, rudder: 0, wind, quay: !libre(sit), contacts: [], catways, pannes, neighbors, pivot: null, options };
}
