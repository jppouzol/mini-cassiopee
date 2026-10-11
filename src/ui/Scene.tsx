import { useEffect, useRef, useState } from 'react';
import type { Body, SimState, Vec } from '../sim/types.ts';
import { readPalette, render } from '../render/renderer.ts';

interface Props {
  state: Readonly<SimState>;
  ghost: Body | null;
  debug: boolean;
  bollards: Vec[];
}

/** Toile de la scène : redessinée à chaque rendu, à chaque redimensionnement et à chaque changement de thème. */
export function Scene({ state, ghost, debug, bollards }: Props) {
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
    });
  });

  void themeTick;
  return <canvas ref={ref} aria-label="Vue de dessus du bateau amarré au quai" />;
}
