import type { Effect, Forces, Params, SimState } from './types.ts';
import { BASE_EFFECTS } from './effects.ts';
import { DT, SUBSTEPS } from './params.ts';

/** Un sous-pas d'intégration (Euler semi-implicite). */
function substep(s: SimState, p: Params, effects: readonly Effect[]): void {
  const f: Forces = { fx: 0, fy: 0, m: 0 };
  for (const effect of effects) effect(s, p, f);
  const b = s.body;
  const c = Math.cos(b.th), sn = Math.sin(b.th);
  // Accélération en repère bateau : masses différentes selon l'axe.
  const abx = (c * f.fx + sn * f.fy) / p.mx;
  const aby = (-sn * f.fx + c * f.fy) / p.my;
  b.vx += (c * abx - sn * aby) * DT;
  b.vy += (sn * abx + c * aby) * DT;
  b.w += (f.m / p.I) * DT;
  b.x += b.vx * DT;
  b.y += b.vy * DT;
  b.th += b.w * DT;
}

/**
 * Point de pivot : point de l'axe longitudinal dont la vitesse latérale est nulle.
 * Masqué quand le bateau translate sans tourner vraiment, lissé pour éviter le scintillement.
 */
function updatePivot(s: SimState, p: Params): void {
  const b = s.body;
  const v = -Math.sin(b.th) * b.vx + Math.cos(b.th) * b.vy;
  const speed = Math.hypot(b.vx, b.vy);
  if (Math.abs(b.w) < 0.012 || (Math.abs(b.w) * p.L) / 2 < 0.4 * speed) {
    s.pivot = null;
    return;
  }
  const raw = Math.max(-p.L / 2, Math.min(p.L / 2, -v / b.w));
  s.pivot = s.pivot === null ? raw : s.pivot + 0.15 * (raw - s.pivot);
}

/** Fait avancer la simulation d'une image (1/60 s). Modifie l'état en place. */
export function tick(s: SimState, p: Params, effects: readonly Effect[] = BASE_EFFECTS): void {
  for (let i = 0; i < SUBSTEPS; i++) substep(s, p, effects);
  updatePivot(s, p);
  s.frame += 1;
}

/** Copie profonde d'un état. */
export function cloneState(s: SimState): SimState {
  return {
    frame: s.frame,
    body: { ...s.body },
    lines: s.lines.map((l) => ({ ...l, cleat: [l.cleat[0], l.cleat[1]], bollard: [l.bollard[0], l.bollard[1]] })),
    engine: s.engine,
    rudder: s.rudder,
    wind: { to: [s.wind.to[0], s.wind.to[1]], force: s.wind.force },
    contacts: s.contacts.map((c) => [c[0], c[1]]),
    pivot: s.pivot,
  };
}
