import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Body, SimState, Vec } from '../sim/types.ts';
import { toWorld } from '../sim/geometry.ts';
import { TOUCH_RADIUS, camera, readPalette, render, type EditionView } from '../render/renderer.ts';

/** Ce que l'élève a touché sur la scène pendant l'édition. */
export type Pick =
  | { kind: 'cleat'; name: string }
  | { kind: 'bollard'; x: number }
  | { kind: 'none' };

interface Props {
  state: Readonly<SimState>;
  ghost: Body | null;
  debug: boolean;
  bollards: Vec[];
  edition: EditionView | null;
  onPick: (p: Pick) => void;
}

/** Toile de la scène : redessinée à chaque rendu, à chaque redimensionnement et à chaque changement de thème. */
export function Scene({ state, ghost, debug, bollards, edition, onPick }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
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
      edition,
    });
  });

  // Toucher pendant l'édition : la cible la plus proche dans le rayon tactile, taquet ou bitte.
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
      if (d < bestD) { bestD = d; best = { kind: 'bollard', x: b[0] }; }
    }
    onPick(best);
  };

  void themeTick;
  return (
    <canvas ref={ref} onPointerDown={onPointerDown} className={edition ? 'editing' : undefined}
      aria-label={edition
        ? 'Vue de dessus du bateau amarré au quai. Touchez un taquet du bateau, puis une bitte du quai, pour ajouter une aussière.'
        : 'Vue de dessus du bateau amarré au quai'} />
  );
}
