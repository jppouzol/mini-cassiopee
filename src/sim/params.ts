import type { Params } from './types.ts';

/**
 * Paramètres physiques par défaut.
 * Volontairement qualitatifs : ils donnent des translations et des pivots plausibles,
 * pas des valeurs réelles.
 */
export const DEFAULT_PARAMS: Readonly<Params> = Object.freeze({
  L: 10,
  B: 3.4,
  mx: 6500, // masse longitudinale, eau entraînée comprise (kg)
  my: 9500, // masse latérale (kg)
  I: 80000, // inertie de lacet (kg·m²)
  thrustFwd: 2500, // poussée en marche avant (N)
  thrustRev: 1700, // poussée en marche arrière (N)
  xProp: -3.4, // position de l'hélice (m)
  xRudder: -4.3, // position du safran (m)
  rudderWash: 0.7, // efficacité du flux d'hélice sur le safran
  rudderFlow: 900, // efficacité de l'erre sur le safran
  dragXq: 420,
  dragXl: 180,
  dragYq: 4500, // résistance latérale répartie (plan anti-dérive)
  dragYl: 2600,
  yawL: 30000,
  windFaible: 450, // force du vent par le travers (N)
  windSoutenu: 1400,
  windLongRatio: 0.35,
  lineK: 45000, // raideur des aussières (N/m)
  lineC: 9000,
  contactK: 320000,
  contactC: 30000,
  contactMu: 0.35,
  contactCt: 40000,
});

/** Pas d'intégration (s) et nombre de sous-pas par image de 1/60 s. */
export const DT = 1 / 240;
export const SUBSTEPS = 4;
export const FPS = 60;
