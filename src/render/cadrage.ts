// Cadrage de la scène : zoom et déplacement de la vue, au doigt ou à la molette.
// Fonctions pures, sans dépendance au navigateur ni à la simulation, testées seules.
//
// Le cadrage s'ajoute au cadrage par défaut de la caméra, qui suit le bateau : il en garde
// le suivi. Le décalage est borné pour que la vue zoomée reste dans le cadrage par défaut ;
// ces bornes ne dépendent que de la taille de la scène et du facteur de zoom.

/** Zoom choisi par l'élève, relatif au cadrage par défaut. */
export interface Cadrage {
  /** facteur de zoom, de 1 (cadrage par défaut) à ZOOM_MAX */
  k: number;
  /** décalage du centre de la vue par rapport au cadrage par défaut, en mètres (repère monde) */
  ox: number;
  oy: number;
}

export const CADRAGE_DEFAUT: Cadrage = { k: 1, ox: 0, oy: 0 };

/** Facteur de zoom maximal : à ×4, le bateau remplit l'écran d'un téléphone. */
export const ZOOM_MAX = 4;

/** Deux doigts posés sur la scène : milieu (px) et écart (px). */
export interface Pincement {
  x: number;
  y: number;
  d: number;
}

/** Échelle du cadrage par défaut, en pixels par mètre : cadrage plus serré sur un écran étroit. */
export function echelleDefaut(W: number, H: number): number {
  const narrow = W < 520;
  return Math.max(6, Math.min(W / (narrow ? 21 : 30), H / 17));
}

/** Vrai si le cadrage est celui par défaut (rien à recadrer). */
export function estDefaut(c: Cadrage): boolean {
  return c.k === 1 && c.ox === 0 && c.oy === 0;
}

/** Borne le facteur entre 1 et ZOOM_MAX, et le décalage pour que la vue reste dans le cadrage par défaut. */
export function bornerCadrage(c: Cadrage, W: number, H: number): Cadrage {
  const k = Math.min(ZOOM_MAX, Math.max(1, Number.isFinite(c.k) ? c.k : 1));
  if (k === 1) return CADRAGE_DEFAUT;
  const sc0 = echelleDefaut(W, H);
  // Demi-largeur et demi-hauteur du cadrage par défaut, moins celles de la vue zoomée.
  const mx = (W / 2 / sc0) * (1 - 1 / k);
  const my = (H / 2 / sc0) * (1 - 1 / k);
  const borne = (v: number, m: number) => (Number.isFinite(v) ? Math.min(m, Math.max(-m, v)) : 0);
  return { k, ox: borne(c.ox, mx), oy: borne(c.oy, my) };
}

/** Change le facteur sans bornes, en gardant en place le point monde sous le point écran (px, py). */
function zoomLibre(c: Cadrage, W: number, H: number, px: number, py: number, k: number): Cadrage {
  const sc0 = echelleDefaut(W, H);
  const r = 1 / c.k - 1 / k;
  return { k, ox: c.ox + ((px - W / 2) / sc0) * r, oy: c.oy - ((py - H / 2) / sc0) * r };
}

/** Bornes du facteur appliquées avant le calcul du décalage, pour que le point visé reste en place. */
const borneK = (k: number) => Math.min(ZOOM_MAX, Math.max(1, k));

/** Zoom d'un facteur autour d'un point de l'écran (molette, pincement du pavé tactile). */
export function zoomerAutour(c: Cadrage, W: number, H: number, px: number, py: number, facteur: number): Cadrage {
  return bornerCadrage(zoomLibre(c, W, H, px, py, borneK(c.k * facteur)), W, H);
}

/**
 * Pincement entre deux positions des doigts : zoom autour de l'ancien milieu, dans le rapport des écarts,
 * puis déplacement de la vue avec le milieu, pour que la scène suive les doigts.
 */
export function pincer(c: Cadrage, W: number, H: number, avant: Pincement, apres: Pincement): Cadrage {
  const facteur = avant.d > 0 && apres.d > 0 ? apres.d / avant.d : 1;
  const z = zoomLibre(c, W, H, avant.x, avant.y, borneK(c.k * facteur));
  const sc = echelleDefaut(W, H) * z.k;
  return bornerCadrage({ k: z.k, ox: z.ox - (apres.x - avant.x) / sc, oy: z.oy + (apres.y - avant.y) / sc }, W, H);
}

/** Longueur de l'échelle (m) : 5, 2 ou 1 m, la plus grande qui ne dépasse pas sa longueur au cadrage par défaut. */
export function longueurEchelle(k: number): number {
  for (const l of [5, 2]) if (l * k <= 5 + 1e-9) return l;
  return 1;
}
