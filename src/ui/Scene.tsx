import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Body, SimState, Vec } from '../sim/types.ts';
import { HULL, toWorld } from '../sim/geometry.ts';
import { TOUCH_RADIUS, camera, readPalette, render, type EditionView } from '../render/renderer.ts';

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
export function Scene({ state, ghost, debug, bollards, otherBollards, edition, onPick, onDragStart, onDrag }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });
  const [themeTick, setThemeTick] = useState(0);

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
    return () => { ro.disconnect(); mq.removeEventListener('change', bump); mo.disconnect(); };
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
    });
  });

  // Toucher pendant l'édition : un toucher bref choisit la cible la plus proche dans le rayon
  // tactile (taquet ou bitte) ; un glisser commencé sur le bateau le déplace le long du quai ou du catway.
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!edition) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const cam = camera(state, r.width, r.height);
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
    gesture.current = { pointer: e.pointerId, px, py, pick: best, onBoat: boat, moved: false, dragging: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId || !edition) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (!g.moved && Math.hypot(px - g.px, py - g.py) > DRAG_THRESHOLD) {
      g.moved = true;
      if (g.onBoat) {
        g.dragging = true;
        setDragging(true);
        onDragStart();
      }
    }
    // Le déplacement est mesuré depuis le début du geste : la position visée ne dérive pas.
    if (g.dragging) {
      const sc = camera(state, r.width, r.height).sc;
      onDrag((px - g.px) / sc, -(py - g.py) / sc);
    }
  };

  const endGesture = (e: PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (!cancelled && !g.moved && edition) onPick(g.pick);
  };

  void themeTick;
  return (
    <canvas ref={ref} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={(e) => endGesture(e, false)} onPointerCancel={(e) => endGesture(e, true)}
      className={edition ? (dragging ? 'editing dragging' : 'editing') : undefined}
      aria-label={edition
        ? `Vue de dessus du bateau amarré ${state.catways.length ? 'le long d’un catway' : 'au quai'}. Touchez un taquet du bateau, puis une bitte du quai${state.catways.length ? ' ou du catway' : ''}, pour ajouter une aussière. Faites glisser le bateau pour le déplacer le long du ${state.catways.length ? 'catway' : 'quai'}.`
        : `Vue de dessus du bateau amarré ${state.catways.length ? 'le long d’un catway' : 'au quai'}`} />
  );
}
