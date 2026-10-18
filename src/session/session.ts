import type { Engine, Params, SimState } from '../sim/types.ts';
import { cloneState, tick } from '../sim/engine.ts';
import { startKick } from '../sim/kick.ts';
import { FPS } from '../sim/params.ts';

/** Actions de l'élève pendant la manœuvre. */
export type Action =
  | { type: 'engine'; value: Engine }
  /** coup de fouet, en avant (1) ou en arrière (-1) */
  | { type: 'kick'; value: 1 | -1 }
  | { type: 'rudder'; value: number }
  | { type: 'cast-off'; lineId: string }
  /** choquer (value = true : l'aussière file) ou bloquer (false) */
  | { type: 'pay-out'; lineId: string; value: boolean };

interface LoggedAction {
  frame: number;
  action: Action;
}

/** Intervalle entre deux images clés (images). */
export const KEYFRAME_INTERVAL = FPS;
/** Durée maximale d'une manœuvre enregistrée (images). */
export const MAX_FRAMES = FPS * 60 * 30;

export function applyAction(s: SimState, a: Action): void {
  switch (a.type) {
    // Une action moteur arrête le coup de fouet en cours.
    case 'engine': s.engine = a.value; s.kick = null; break;
    case 'kick': startKick(s, a.value); break;
    case 'rudder': s.rudder = a.value; break;
    case 'cast-off': {
      const line = s.lines.find((l) => l.id === a.lineId);
      if (line) line.attached = false;
      break;
    }
    case 'pay-out': {
      const line = s.lines.find((l) => l.id === a.lineId);
      if (line) line.payingOut = a.value;
      break;
    }
  }
}

/**
 * Session de manœuvre : situation de départ, journal horodaté des actions et
 * images clés. Seule la session fait avancer la simulation.
 *
 * Convention : l'état de l'image n est obtenu après n pas de simulation, en
 * appliquant les actions notées à chaque image juste après l'avoir atteinte.
 */
export class Session {
  private readonly keyframes = new Map<number, SimState>();
  private log: LoggedAction[] = [];
  private cur: SimState;
  private params: Params;
  private readonly initial: SimState;
  /** Dernière image enregistrée. */
  private end = 0;

  constructor(initial: SimState, params: Params) {
    this.initial = cloneState(initial);
    this.params = params;
    this.cur = cloneState(initial);
    this.keyframes.set(0, cloneState(initial));
  }

  /** État affiché (ne pas modifier). */
  get state(): Readonly<SimState> { return this.cur; }
  get frame(): number { return this.cur.frame; }
  get lastFrame(): number { return this.end; }
  get atEnd(): boolean { return this.cur.frame >= this.end; }
  get initialState(): Readonly<SimState> { return this.initial; }

  /** Applique une action à l'image affichée. La suite éventuellement enregistrée est effacée. */
  act(action: Action): void {
    const f = this.cur.frame;
    this.truncateAfter(f);
    this.log.push({ frame: f, action });
    applyAction(this.cur, action);
    if (this.keyframes.has(f)) this.keyframes.set(f, cloneState(this.cur));
  }

  /** Change les paramètres physiques ; la suite enregistrée est effacée. */
  setParams(params: Params): void {
    this.params = params;
    this.truncateAfter(this.cur.frame);
  }

  /** Avance de n images : relit ce qui est enregistré, puis simule au-delà. */
  advance(n = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.cur.frame >= MAX_FRAMES) return;
      this.stepFrom(this.cur);
      if (this.cur.frame > this.end) {
        this.end = this.cur.frame;
        if (this.cur.frame % KEYFRAME_INTERVAL === 0) this.keyframes.set(this.cur.frame, cloneState(this.cur));
      }
    }
  }

  /** Affiche l'image demandée, dans les limites de ce qui est enregistré. */
  seek(target: number): void {
    const f = Math.max(0, Math.min(this.end, Math.round(target)));
    if (f === this.cur.frame) return;
    if (f > this.cur.frame && f - this.cur.frame < KEYFRAME_INTERVAL) {
      this.advance(f - this.cur.frame);
      return;
    }
    const k = Math.floor(f / KEYFRAME_INTERVAL) * KEYFRAME_INTERVAL;
    const key = this.keyframes.get(k);
    if (!key) throw new Error(`Image clé manquante : ${k}`);
    this.cur = cloneState(key);
    while (this.cur.frame < f) this.stepFrom(this.cur);
  }

  private stepFrom(s: SimState): void {
    tick(s, this.params);
    for (const entry of this.log) if (entry.frame === s.frame) applyAction(s, entry.action);
  }

  private truncateAfter(f: number): void {
    if (f >= this.end && this.log.every((e) => e.frame <= f)) return;
    this.log = this.log.filter((e) => e.frame <= f);
    for (const k of [...this.keyframes.keys()]) if (k > f) this.keyframes.delete(k);
    this.end = f;
  }
}
