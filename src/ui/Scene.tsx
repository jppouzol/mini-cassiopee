import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Body, SimState, Vec } from '../sim/types.ts';
import { HULL, toWorld } from '../sim/geometry.ts';
import { TOUCH_RADIUS, camera, readPalette, render, type EditionView } from '../render/renderer.ts';
import { CADRAGE_DEFAUT, estDefaut, pincer, zoomerAutour, type Cadrage, type Pincement } from '../render/cadrage.ts';

/** Ce que l'élève a touché sur la scène pendant l'édition. */
export type Pick =
  | { kind: 'cleat'; name: string }
  /** bitte du quai ou du catway, en repère monde */
  | { kind: 'bollard'; p: Vec }
  | { kind: 'none' };

interface Props {
  state: Readonly<SimState>;
  ghost: Body | null;
  debug: boolean;
  bollards: Vec[];
  /** bittes dessinées mais jamais proposées (celles de l'autre catway) */
  otherBollards: Vec[];
  edition: EditionView | null;
  onPick: (p: Pick) => void;
  /** Début d'un glisser du bateau pendant l'édition. */
  onDragStart: () => void;
  /** Glisser en cours : déplacement du doigt depuis le début du geste, en repère monde (m). */
  onDrag: (dx: number, dy: number) => void;
  /** Identifie la situation d'origine : quand elle change, le zoom revient au cadrage par défaut. */
  cadrageCle: string;
}

/** Au-delà de ce déplacement du doigt (px), un toucher devient un glisser. */
const DRAG_THRESHOLD = 8;

/** Geste en cours sur la scène pendant l'édition. */
interface Gesture {
  pointer: number;
  px: number;
  py: number;
  /** Cible sous le doigt au toucher, retenue si le doigt ne bouge pas. */
  pick: Pick;
  /** Le geste a commencé sur la coque ou un taquet : il peut déplacer le bateau. */
  onBoat: boolean;
  moved: boolean;
  dragging: boolean;
  /** Souris : un glisser commencé hors du bateau déplace la vue, comme deux doigts sur téléphone. */
  mouse: boolean;
  /** Vue en cours de déplacement à la souris : dernière position du pointeur. */
  pan: { x: number; y: number } | null;
}

/** Milieu et écart des deux premiers doigts posés. */
function pincement(doigts: Map<number, { x: number; y: number }>): Pincement {
  const [a, b] = [...doigts.values()];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(b.x - a.x, b.y - a.y) };
}

/** Vrai si le point monde est sur la coque (test pair-impair sur le contour, en repère bateau). */
function onHull(body: Body, w: Vec): boolean {
  const c = Math.cos(body.th), s = Math.sin(body.th);
  const dx = w[0] - body.x, dy = w[1] - body.y;
  const x = c * dx + s * dy, y = -s * dx + c * dy;
  let inside = false;
  for (let i = 0, j = HULL.length - 1; i < HULL.length; j = i++) {
    const [xi, yi] = HULL[i], [xj, yj] = HULL[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Toile de la scène : redessinée à chaque rendu, à chaque redimensionnement et à chaque changement de thème. */
export function Scene({ state, ghost, debug, bollards, otherBollards, edition, onPick, onDragStart, onDrag, cadrageCle }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  const [themeTick, setThemeTick] = useState(0);
  // Zoom de l'élève : réglage d'affichage, sans effet sur la simulation.
  const [cadrage, setCadrageState] = useState<Cadrage>(CADRAGE_DEFAUT);
  const cadrageRef = useRef<Cadrage>(CADRAGE_DEFAUT);
  const setCadrage = (c: Cadrage) => { cadrageRef.current = c; setCadrageState(c); };
  /** Doigts posés sur la scène (px, repère de la toile). */
  const doigts = useRef(new Map<number, { x: number; y: number }>());
  /** Pincement en cours : dernière position des deux doigts. */
  const pinch = useRef<Pincement | null>(null);
  /** Après un geste à plusieurs doigts, on attend que tous soient levés avant un nouveau geste à un doigt. */
  const bloque = useRef(false);

  // Nouvelle situation : nouvelle scène, cadrage par défaut.
  useEffect(() => { setCadrage(CADRAGE_DEFAUT); }, [cadrageCle]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      setSize({ w: r.width, h: r.height, dpr: window.devicePixelRatio || 1 });
    });
    ro.observe(canvas);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const bump = () => setThemeTick((t) => t + 1);
    mq.addEventListener('change', bump);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.fonts?.ready.then(bump).catch(() => undefined);

    // Molette (et pincement du pavé tactile, signalé par ctrlKey) : zoom autour du pointeur.
    // La page ne défile plus dès que la scène est zoomée ; au cadrage par défaut, dézoomer la laisse défiler.
    const onWheel = (e: WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * r.height : e.deltaY;
      const c0 = cadrageRef.current;
      const c1 = zoomerAutour(c0, r.width, r.height, e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)));
      if (e.ctrlKey || !estDefaut(c0) || !estDefaut(c1)) e.preventDefault();
      if (c1.k !== c0.k || c1.ox !== c0.ox || c1.oy !== c0.oy) setCadrage(c1);
    };
    // Safari sur iOS : pas de zoom de la page par un pincement sur la scène.
    const noGesture = (e: Event) => e.preventDefault();
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('gesturestart', noGesture);
    return () => {
      ro.disconnect(); mq.removeEventListener('change', bump); mo.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('gesturestart', noGesture);
    };
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || size.w === 0) return;
    const pw = Math.round(size.w * size.dpr), ph = Math.round(size.h * size.dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const root = document.documentElement;
    render(ctx, state, {
      width: size.w,
      height: size.h,
      dpr: size.dpr,
      palette: readPalette(root),
      labelFont: getComputedStyle(root).getPropertyValue('--f-label').trim() || 'sans-serif',
      ghost,
      debug,
      bollards,
      otherBollards,
      edition,
      cadrage,
    });
  });

  // Un doigt pendant l'édition : un toucher bref choisit la cible la plus proche dans le rayon
  // tactile (taquet ou bitte) ; un glisser commencé sur le bateau le déplace le long du quai ou du catway.
  // Deux doigts, en préparation comme en simulation : pincement pour zoomer et déplacer la vue.
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    doigts.current.set(e.pointerId, { x: px, y: py });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (doigts.current.size >= 2) {
      // Un second doigt annule le geste à un doigt : ni sélection, ni déplacement du bateau.
      const g = gesture.current;
      if (g?.dragging) onDrag(0, 0);
      gesture.current = null;
      setDragging(false);
      bloque.current = true;
      if (doigts.current.size === 2) pinch.current = pincement(doigts.current);
      return;
    }
    if (bloque.current) return;
    const mouse = e.pointerType === 'mouse';
    if (!edition) {
      // En simulation, seule la souris a un geste à un bouton : déplacer la vue.
      if (mouse && e.button === 0) {
        gesture.current = { pointer: e.pointerId, px, py, pick: { kind: 'none' }, onBoat: false, moved: false, dragging: false, mouse, pan: null };
      }
      return;
    }
    if (mouse && e.button !== 0) return;
    const cam = camera(state, r.width, r.height, cadrage);
    let best: Pick = { kind: 'none' };
    let bestD = TOUCH_RADIUS;
    for (const c of edition.cleats) {
      const w = toWorld(state.body, c.pos);
      const d = Math.hypot(cam.X(w[0]) - px, cam.Y(w[1]) - py);
      if (d <= bestD) { bestD = d; best = { kind: 'cleat', name: c.name }; }
    }
    for (const b of bollards) {
      const d = Math.hypot(cam.X(b[0]) - px, cam.Y(b[1]) - py);
      if (d < bestD) { bestD = d; best = { kind: 'bollard', p: b }; }
    }
    const boat = best.kind === 'cleat' || (best.kind === 'none' && onHull(state.body, cam.toWorld(px, py)));
    gesture.current = { pointer: e.pointerId, px, py, pick: best, onBoat: boat, moved: false, dragging: false, mouse, pan: null };
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!doigts.current.has(e.pointerId)) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    doigts.current.set(e.pointerId, { x: px, y: py });
    const avant = pinch.current;
    if (avant && doigts.current.size >= 2) {
      const apres = pincement(doigts.current);
      pinch.current = apres;
      setCadrage(pincer(cadrageRef.current, r.width, r.height, avant, apres));
      return;
    }
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    if (!g.moved && Math.hypot(px - g.px, py - g.py) > DRAG_THRESHOLD) {
      g.moved = true;
      if (g.onBoat && edition) {
        g.dragging = true;
        setDragging(true);
        onDragStart();
      } else if (g.mouse) {
        // Souris hors du bateau : la vue suit le pointeur depuis le début du geste.
        g.pan = { x: g.px, y: g.py };
        setDragging(true);
      }
    }
    if (g.pan) {
      const d = { x: g.pan.x, y: g.pan.y, d: 1 };
      g.pan = { x: px, y: py };
      setCadrage(pincer(cadrageRef.current, r.width, r.height, d, { x: px, y: py, d: 1 }));
      return;
    }
    // Le déplacement est mesuré depuis le début du geste : la position visée ne dérive pas.
    if (g.dragging) {
      const sc = camera(state, r.width, r.height, cadrage).sc;
      onDrag((px - g.px) / sc, -(py - g.py) / sc);
    }
  };

  const endGesture = (e: PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    doigts.current.delete(e.pointerId);
    // Le pincement s'arrête dès qu'un doigt se lève ; un nouveau doigt le relance.
    if (doigts.current.size < 2) pinch.current = null;
    if (doigts.current.size === 0) bloque.current = false;
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (!cancelled && !g.moved && edition) onPick(g.pick);
  };

  void themeTick;
  return (
    <>
    <canvas ref={ref} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={(e) => endGesture(e, false)} onPointerCancel={(e) => endGesture(e, true)}
      className={[edition ? 'editing' : '', dragging ? 'dragging' : '', estDefaut(cadrage) ? '' : 'zoomed'].filter(Boolean).join(' ') || undefined}
      aria-label={!state.quay
        ? 'Vue de dessus du bateau libre, en milieu de port, sans quai ni amarre. Pincez à deux doigts, ou utilisez la molette, pour zoomer.'
        : edition
        ? `Vue de dessus du bateau amarré ${state.catways.length ? 'le long d’un catway' : 'au quai'}. Touchez un taquet du bateau, puis une bitte du quai${state.catways.length ? ' ou du catway' : ''}, pour ajouter une aussière. Faites glisser le bateau pour le déplacer le long du ${state.catways.length ? 'catway' : 'quai'}. Pincez à deux doigts, ou utilisez la molette, pour zoomer.`
        : `Vue de dessus du bateau amarré ${state.catways.length ? 'le long d’un catway' : 'au quai'}. Pincez à deux doigts, ou utilisez la molette, pour zoomer.`} />
    {!estDefaut(cadrage) && (
      <button type="button" className="btn recadrer" onClick={() => setCadrage(CADRAGE_DEFAUT)}
        title="Revenir au cadrage par défaut">Recadrer</button>
    )}
    </>
  );
}
