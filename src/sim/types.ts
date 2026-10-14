// Types du moteur de simulation.
// Repère monde : x le long du quai, y vers le quai (le quai occupe y > 0, l'eau y < 0).
// Repère bateau : x vers l'avant, y vers bâbord. Cap 0 : étrave vers +x.
// Unités SI : mètres, secondes, newtons, radians.

export type Vec = [number, number];

export interface Body {
  x: number;
  y: number;
  /** cap (rad) */
  th: number;
  vx: number;
  vy: number;
  /** vitesse de lacet (rad/s) */
  w: number;
}

export interface MooringLine {
  id: string;
  name: string;
  /** taquet, en repère bateau */
  cleat: Vec;
  /** bitte, en repère monde */
  bollard: Vec;
  /** longueur maximale (m) */
  len: number;
  attached: boolean;
  /**
   * aussière choquée : elle file aussi vite que le bateau s'éloigne de la bitte,
   * sans le retenir ; bloquée (false), sa longueur ne change pas
   */
  payingOut: boolean;
  /** tension calculée à la dernière image (N) */
  tension: number;
}

export type Engine = -1 | 0 | 1;
export type WindForce = 'aucun' | 'faible' | 'soutenu';

export interface Wind {
  /** direction vers laquelle souffle le vent, vecteur unitaire monde */
  to: Vec;
  force: WindForce;
}

/**
 * Bateau voisin : même coque que le bateau simulé, immobile. Il sert
 * d'obstacle et peut faire point d'appui, comme le quai.
 */
export interface Neighbor {
  id: string;
  /** position du centre et cap, fixes (repère monde) */
  x: number;
  y: number;
  th: number;
  /** points de contact avec le bateau à la dernière image (repère monde) */
  contacts: Vec[];
}

/**
 * Catway : petit ponton immobile accroché au bord du quai (y = 0), qui descend
 * dans l'eau (y < 0) sur sa longueur, centré sur l'abscisse x.
 */
export interface Catway {
  /** abscisse de l'axe (m, repère monde) */
  x: number;
  /** demi-largeur (m) */
  halfWidth: number;
  /** longueur depuis le bord du quai (m) */
  length: number;
}

export interface SimState {
  /** numéro d'image (60 images par seconde) */
  frame: number;
  body: Body;
  lines: MooringLine[];
  engine: Engine;
  /** angle de barre (rad), > 0 : le bateau tourne vers bâbord */
  rudder: number;
  wind: Wind;
  /** points d'appui sur le quai et le catway à la dernière image (repère monde) */
  contacts: Vec[];
  /** catway, immobile, ou null le long du quai */
  catway: Catway | null;
  /** bateaux voisins, immobiles (liste vide sans voisin) */
  neighbors: Neighbor[];
  /** position du point de pivot sur l'axe (m, repère bateau), null si le bateau ne tourne pas */
  pivot: number | null;
}

export interface Params {
  L: number;
  B: number;
  mx: number;
  my: number;
  I: number;
  thrustFwd: number;
  thrustRev: number;
  xProp: number;
  xRudder: number;
  rudderWash: number;
  rudderFlow: number;
  dragXq: number;
  dragXl: number;
  dragYq: number;
  dragYl: number;
  yawL: number;
  windFaible: number;
  windSoutenu: number;
  windLongRatio: number;
  lineK: number;
  lineC: number;
  contactK: number;
  contactC: number;
  contactMu: number;
  contactCt: number;
}

/** Accumulateur de forces exprimées dans le repère monde, moment autour du centre. */
export interface Forces {
  fx: number;
  fy: number;
  m: number;
}

/** Un effet ajoute sa contribution aux forces. Il peut renseigner l'état (tensions, contacts). */
export type Effect = (s: SimState, p: Params, f: Forces) => void;
