import type { SimState, Vec, Wind } from '../sim/types.ts';
import { cleatPosition, toWorld } from '../sim/geometry.ts';
import type { Situation, WindDirection } from './schema.ts';
import { BOLLARD_SETBACK, bitteVersMonde, bowSign, yDepart } from './quai.ts';
import { nomsAffiches } from './edit.ts';

export { BOLLARD_SETBACK, BOLLARD_SPACING } from './quai.ts';

const S2 = Math.SQRT1_2;

/**
 * Direction vers laquelle souffle le vent, en repère monde.
 * « avant » et « arrière » se rapportent au cap du bateau au départ.
 */
export function windVector(direction: WindDirection, bowSign: 1 | -1): Vec {
  const fromQuay: Vec = [0, -1];
  const fromSea: Vec = [0, 1];
  const fromAhead: Vec = [-bowSign, 0];
  const fromAstern: Vec = [bowSign, 0];
  const mix = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) * S2, (a[1] + b[1]) * S2];
  switch (direction) {
    case 'quai': return fromQuay;
    case 'large': return fromSea;
    case 'avant': return fromAhead;
    case 'arriere': return fromAstern;
    case 'quai-avant': return mix(fromQuay, fromAhead);
    case 'quai-arriere': return mix(fromQuay, fromAstern);
    case 'large-avant': return mix(fromSea, fromAhead);
    case 'large-arriere': return mix(fromSea, fromAstern);
  }
}

/** Cap initial et côté du quai en repère bateau. */
export function startPose(sit: Situation): { x: number; y: number; th: number; bowSign: 1 | -1 } {
  const sign = bowSign(sit);
  return {
    x: sit.bateau.x,
    y: yDepart(sit),
    // Bâbord au quai : étrave vers +x. Tribord au quai : étrave vers -x.
    th: sign === 1 ? 0 : Math.PI,
    bowSign: sign,
  };
}

/** Construit l'état initial de la simulation à partir d'une situation validée. */
export function buildState(sit: Situation, windOverride?: Situation['vent']): SimState {
  const pose = startPose(sit);
  // Avec un cap de π, le côté bâbord (+y bateau) regarde le large : le quai est à tribord.
  const quaySide: 1 | -1 = pose.bowSign === 1 ? 1 : -1;
  const body = { x: pose.x, y: pose.y, th: pose.th, vx: 0, vy: 0, w: 0 };
  const names = nomsAffiches(sit);
  const lines = sit.aussieres.map((a, i) => {
    const cleat = cleatPosition(a.taquet, quaySide);
    const bollard: Vec = [bitteVersMonde(sit, a.bitte), BOLLARD_SETBACK];
    const cw = toWorld(body, cleat);
    const dist = Math.hypot(cw[0] - bollard[0], cw[1] - bollard[1]);
    return { id: a.id, name: names[i], cleat, bollard, len: dist + a.mou, attached: true, payingOut: a.file === true, tension: 0 };
  });
  const v = windOverride ?? sit.vent;
  const wind: Wind = { to: windVector(v.direction, pose.bowSign), force: v.force };
  return { frame: 0, body, lines, engine: 0, rudder: 0, wind, contacts: [], pivot: null };
}
