import type { Engine, Params, SimState } from './types.ts';
import { FPS } from './params.ts';

// Coup de fouet : poussée brève et forte du moteur, en avant ou en arrière,
// suivie d'un retour automatique. Ce n'est pas un effet optionnel mais un état
// du moteur (`SimState.kick`), changé par une action de l'élève.
//
// `engine` garde la position où le moteur reviendra après le coup, ralenti compris. Les forces
// (poussée, flux d'hélice, pas d'hélice) lisent le sens et le facteur de la
// poussée du moment par `thrustOf`.

/**
 * Erre minimale (m/s) dans le sens de l'ancienne marche pour qu'un coup à
 * contre-sens serve à la casser ; en dessous (bateau retenu par une garde,
 * par exemple), le coup a la durée fixe.
 */
export const KICK_ERRE_MIN = 0.05;

/** Positions de la commande moteur, de la marche arrière à la marche avant, ralentis compris. */
export const ENGINE_POSITIONS: readonly Engine[] = [-1, -0.5, 0, 0.5, 1];

/** Vitesse longitudinale (m/s), positive vers l'avant. */
function surge(s: SimState): number {
  const b = s.body;
  return Math.cos(b.th) * b.vx + Math.sin(b.th) * b.vy;
}

/**
 * Démarre un coup de fouet dans le sens `dir`, en remplaçant celui en cours.
 * Depuis le neutre ou dans le sens de `engine`, le coup a la durée fixe et le
 * moteur reprendra sa position. À contre-sens de `engine`, le moteur reviendra
 * au neutre et le coup casse l'erre, si le bateau en a dans l'ancien sens.
 * Indépendant des paramètres : appelé par la session quand l'élève agit.
 */
export function startKick(s: SimState, dir: 1 | -1): void {
  if (Math.sign(s.engine) === -dir) {
    s.engine = 0;
    s.kick = { dir, frames: 0, brake: surge(s) * -dir > KICK_ERRE_MIN };
  } else {
    s.kick = { dir, frames: 0, brake: false };
  }
}

/**
 * Fin du coup, vérifiée par `tick` à chaque image : après `kickTime`, ou, pour
 * un coup qui casse l'erre, dès que le bateau ne va plus dans le sens de
 * l'ancienne marche, au plus tard après `kickMaxTime`.
 */
export function updateKick(s: SimState, p: Params): void {
  const k = s.kick;
  if (!k) return;
  k.frames += 1;
  const done = k.brake
    ? surge(s) * -k.dir <= 0 || k.frames >= Math.round(p.kickMaxTime * FPS)
    : k.frames >= Math.round(p.kickTime * FPS);
  if (done) s.kick = null;
}

/**
 * Sens (-1, 0 ou 1) et facteur de la poussée du moment : celle du coup de fouet, sinon celle
 * du moteur, réduite de `idleFactor` au ralenti. Le coup de fouet garde sa poussée depuis le
 * ralenti : le double de la marche.
 */
export function thrustOf(s: Readonly<SimState>, p: Params): { dir: number; factor: number } {
  if (s.kick) return { dir: s.kick.dir, factor: p.kickFactor };
  return { dir: Math.sign(s.engine), factor: Math.abs(s.engine) === 0.5 ? p.idleFactor : 1 };
}
