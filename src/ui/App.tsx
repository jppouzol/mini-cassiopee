import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Session, type Action } from '../session/session.ts';
import { buildState } from '../situations/build.ts';
import { CATALOGUE } from '../situations/catalogue.ts';
import { WIND_DIRECTIONS, type Situation, type WindDirection } from '../situations/schema.ts';
import { DEFAULT_PARAMS, FPS } from '../sim/params.ts';
import type { Engine, Params } from '../sim/types.ts';
import { TAUT_THRESHOLD } from '../render/renderer.ts';
import { Scene } from './Scene.tsx';
import { Tuning } from './Tuning.tsx';

type WindSetting = Situation['vent'];

const WIND_LABELS: Record<WindDirection, string> = {
  quai: 'Vent du quai',
  large: 'Vent du large',
  avant: "Vent de l'avant",
  arriere: "Vent de l'arrière",
  'quai-avant': "Du quai, de l'avant",
  'quai-arriere': "Du quai, de l'arrière",
  'large-avant': "Du large, de l'avant",
  'large-arriere': "Du large, de l'arrière",
};
const FORCES: { value: WindSetting['force']; label: string }[] = [
  { value: 'aucun', label: 'Pas de vent' },
  { value: 'faible', label: 'Faible' },
  { value: 'soutenu', label: 'Soutenu' },
];
const ENGINE: { value: Engine; label: string }[] = [
  { value: -1, label: 'Arrière' },
  { value: 0, label: 'Neutre' },
  { value: 1, label: 'Avant' },
];
const STEP_FRAMES = 12;
const MAX_RUDDER_DEG = 35;

const fmtTime = (frame: number) => `${(frame / FPS).toFixed(1).replace('.', ',')} s`;
const rudderToDeg = (rad: number) => Math.round((-rad * 180) / Math.PI);
const degToRudder = (deg: number) => (-deg * Math.PI) / 180;

export function App() {
  const [situation, setSituation] = useState<Situation>(CATALOGUE[0]);
  const [wind, setWind] = useState<WindSetting>(CATALOGUE[0].vent);
  const [params, setParams] = useState<Params>({ ...DEFAULT_PARAMS });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ghost, setGhost] = useState(false);
  const [debug, setDebug] = useState(false);
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const sessionRef = useRef<Session | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const newSession = useCallback((sit: Situation, w: WindSetting) => {
    sessionRef.current = new Session(buildState(sit, w), paramsRef.current);
    setPlaying(false);
    refresh();
  }, [refresh]);

  if (sessionRef.current === null) sessionRef.current = new Session(buildState(situation, wind), params);
  const session = sessionRef.current;
  const s = session.state;
  const atStart = session.frame === 0;

  // Boucle de lecture : avance au rythme de l'affichage, en temps simulé régulier.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += (Math.min(0.1, (now - last) / 1000)) * FPS * speed;
      last = now;
      const n = Math.floor(acc);
      if (n > 0) {
        acc -= n;
        session.advance(n);
        refresh();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, session, refresh]);

  const act = useCallback((a: Action) => { sessionRef.current?.act(a); refresh(); }, [refresh]);
  const seek = useCallback((f: number) => { setPlaying(false); sessionRef.current?.seek(f); refresh(); }, [refresh]);
  const step = useCallback((n: number) => {
    const ses = sessionRef.current;
    if (!ses) return;
    setPlaying(false);
    if (n > 0) ses.advance(n); else ses.seek(ses.frame + n);
    refresh();
  }, [refresh]);

  const changeWind = (w: WindSetting) => {
    if (!atStart) return;
    setWind(w);
    newSession(situation, w);
  };
  const changeParams = (p: Params) => {
    setParams(p);
    session.setParams(p);
    refresh();
  };

  // Raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.matches('select, input') && !['Space', 'KeyR', 'KeyC'].includes(e.code)) return;
      const ses = sessionRef.current;
      if (!ses) return;
      const cur = ses.state;
      const deg = rudderToDeg(cur.rudder);
      switch (e.code) {
        case 'Space': setPlaying((p) => !p); break;
        case 'ArrowUp': act({ type: 'engine', value: Math.min(1, cur.engine + 1) as Engine }); break;
        case 'ArrowDown': act({ type: 'engine', value: Math.max(-1, cur.engine - 1) as Engine }); break;
        case 'ArrowLeft': act({ type: 'rudder', value: degToRudder(Math.max(-MAX_RUDDER_DEG, deg - 5)) }); break;
        case 'ArrowRight': act({ type: 'rudder', value: degToRudder(Math.min(MAX_RUDDER_DEG, deg + 5)) }); break;
        case 'KeyC': act({ type: 'rudder', value: 0 }); break;
        case 'KeyR': seek(0); break;
        case 'Comma': step(-STEP_FRAMES); break;
        case 'Period': step(STEP_FRAMES); break;
        default: {
          const n = Number(e.key);
          const l = cur.lines[n - 1];
          if (n >= 1 && l && l.attached) act({ type: 'cast-off', lineId: l.id });
          else return;
        }
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, seek, step]);

  const bollards = useMemo(() => session.initialState.lines.map((l) => l.bollard), [session]);
  const rudderDeg = rudderToDeg(s.rudder);
  const showTuning = typeof location !== 'undefined' && location.hash === '#reglages';
  const status = playing ? (session.atEnd ? 'Simulation' : 'Relecture') : atStart ? 'Prêt · appuyez sur Lecture' : 'En pause';

  return (
    <div className="app">
      <div className="stage">
        <div className="scene">
          <Scene state={s} ghost={ghost ? session.initialState.body : null} debug={debug} bollards={bollards} />
          <div className="badge">{status}</div>
        </div>
        <div className="player">
          <button className="btn" onClick={() => seek(0)} title="Revenir au départ (R)" aria-label="Revenir au départ">⏮</button>
          <button className="btn" onClick={() => step(-STEP_FRAMES)} title="Reculer de 0,2 s (,)" aria-label="Reculer de 0,2 s">◀◀</button>
          <button className="btn primary" onClick={() => setPlaying((p) => !p)} title="Lecture ou pause (Espace)">{playing ? 'Pause' : 'Lecture'}</button>
          <button className="btn" onClick={() => step(STEP_FRAMES)} title="Avancer de 0,2 s (.)" aria-label="Avancer de 0,2 s">▶▶</button>
          <input id="timeline" type="range" min={0} max={session.lastFrame} value={session.frame}
            onChange={(e) => seek(Number(e.target.value))} aria-label="Chronologie de la manœuvre" />
          <span className="time">{fmtTime(session.frame)}</span>
          <select id="speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Vitesse de lecture">
            <option value={0.5}>×0,5</option><option value={1}>×1</option><option value={2}>×2</option><option value={4}>×4</option>
          </select>
        </div>
      </div>

      <aside className="panel">
        <h1>Mini Cassiopée<small>Manœuvres de port · voilier de 10 m</small></h1>

        <section>
          <h2>Situation</h2>
          <select id="situation" value={situation.id} aria-label="Situation de départ"
            onChange={(e) => {
              const sit = CATALOGUE.find((x) => x.id === e.target.value) ?? CATALOGUE[0];
              setSituation(sit);
              setWind(sit.vent);
              newSession(sit, sit.vent);
            }}>
            {CATALOGUE.map((x) => <option key={x.id} value={x.id}>{x.titre}</option>)}
          </select>
          <p className="hint">{situation.description}</p>
          <select id="wind-direction" value={wind.direction} disabled={!atStart} aria-label="Direction du vent"
            onChange={(e) => changeWind({ ...wind, direction: e.target.value as WindDirection })}>
            {WIND_DIRECTIONS.map((d) => <option key={d} value={d}>{WIND_LABELS[d]}</option>)}
          </select>
          <div className="seg" role="group" aria-label="Force du vent">
            {FORCES.map((f) => (
              <button key={f.value} aria-pressed={wind.force === f.value} disabled={!atStart}
                onClick={() => changeWind({ ...wind, force: f.value })}>{f.label}</button>
            ))}
          </div>
          <p className="hint">{atStart
            ? 'Le vent se règle avant le départ et reste fixe pendant la manœuvre.'
            : 'Vent fixé pendant la manœuvre. Revenez au départ (⏮) pour le modifier.'}</p>
        </section>

        <section>
          <h2>Moteur</h2>
          <div className="seg" role="group" aria-label="Moteur">
            {ENGINE.map((m) => (
              <button key={m.value} aria-pressed={s.engine === m.value}
                onClick={() => act({ type: 'engine', value: m.value })}>{m.label}</button>
            ))}
          </div>
        </section>

        <section>
          <h2>Barre</h2>
          <div className="helm">
            <span>Bâbord</span>
            <input id="helm" type="range" min={-MAX_RUDDER_DEG} max={MAX_RUDDER_DEG} step={1} value={rudderDeg}
              onChange={(e) => act({ type: 'rudder', value: degToRudder(Number(e.target.value)) })} aria-label="Angle de barre" />
            <span>Tribord</span>
          </div>
          <div className="row">
            <span className="hint">{rudderDeg === 0 ? 'Barre au centre' : `${rudderDeg < 0 ? 'Bâbord' : 'Tribord'} ${Math.abs(rudderDeg)}°`}</span>
            <button className="btn push-right" onClick={() => act({ type: 'rudder', value: 0 })}>Centrer</button>
          </div>
          <p className="hint">Barre à roue : le bateau tourne du côté choisi.</p>
        </section>

        <section>
          <h2>Amarres</h2>
          <div className="lines">
            {s.lines.length === 0 && <p className="hint">Aucune amarre dans cette situation.</p>}
            {s.lines.map((l, i) => {
              const state = !l.attached ? 'gone' : l.tension > TAUT_THRESHOLD ? 'taut' : 'slack';
              const label = state === 'gone' ? 'Larguée' : state === 'taut' ? (debug ? `${Math.round(l.tension)} N` : 'Tendue') : 'Molle';
              return (
                <div className="line" key={l.id}>
                  <span className={`chip ${state}`} />
                  <span>{l.name}</span>
                  <span className="state">{label}</span>
                  <button className="btn" disabled={!l.attached} title={`Touche ${i + 1}`}
                    onClick={() => act({ type: 'cast-off', lineId: l.id })}>Larguer</button>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2>Affichage</h2>
          <label className="check"><input id="ghost" type="checkbox" checked={ghost} onChange={(e) => setGhost(e.target.checked)} /> Position de départ</label>
          <label className="check"><input id="debug" type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> Valeurs de mise au point</label>
        </section>

        {showTuning && <Tuning params={params} onChange={changeParams} />}

        <p className="keys">
          <kbd>Espace</kbd> lecture · <kbd>↑</kbd><kbd>↓</kbd> moteur · <kbd>←</kbd><kbd>→</kbd> barre · <kbd>C</kbd> centrer ·
          {' '}<kbd>1</kbd>–<kbd>4</kbd> larguer · <kbd>,</kbd><kbd>.</kbd> pas à pas · <kbd>R</kbd> départ
        </p>
      </aside>
    </div>
  );
}
