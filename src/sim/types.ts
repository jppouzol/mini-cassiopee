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
  /** ce que fait l'équipier qui tient le bout (voir `LineMode`) */
  mode: LineMode;
  /** tension calculée au dernier sous-pas (N) */
  tension: number;
  /**
   * tension ressentie par l'équipier (N) : la tension lissée sur `crewHold` secondes, pour
   * qu'il encaisse un à-coup bref (le mou qui se rattrape) sans lâcher
   */
  load: number;
  /**
   * variation de la longueur pendant la dernière image (m/s) : positive quand l'aussière
   * file, négative quand l'équipier la reprend, nulle sinon
   */
  rate: number;
}

/**
 * Ce que fait l'équipier qui tient le bout d'une aussière :
 * - `choque` : il la laisse filer, aussi vite que le bateau s'éloigne de la bitte, sans le retenir ;
 * - `bloque` : elle est tournée au taquet, sa longueur ne change pas (par défaut) ;
 * - `reprend` : il l'embraque à vitesse constante tant que la tension reste sous son effort ;
 *   si le bateau tire nettement plus fort, il ne tient plus et lâche : l'aussière passe
 *   d'elle-même sur `choque`.
 */
export type LineMode = 'choque' | 'bloque' | 'reprend';

/**
 * Position de la commande moteur : marche arrière (-1), ralenti arrière (-0,5), neutre (0),
 * ralenti avant (0,5) ou marche avant (1). Le signe donne le sens de la poussée ; le ralenti
 * la réduit du facteur `idleFactor` (`thrustOf`, dans `src/sim/kick.ts`).
 */
export type Engine = -1 | -0.5 | 0 | 0.5 | 1;

/** Coup de fouet en cours : poussée brève et forte, suivie d'un retour automatique (`src/sim/kick.ts`). */
export interface Kick {
  /** sens du coup : 1 en avant, -1 en arrière */
  dir: 1 | -1;
  /** images écoulées depuis le début du coup */
  frames: number;
  /** coup à contre-sens qui casse l'erre : il s'arrête quand le bateau ne va plus dans l'ancien sens */
  brake: boolean;
}
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
 * Catway : petit ponton immobile, accroché par son pied au bord du quai (y = 0) ou
 * de la panne d'en face (voir RangeeEnFace), qui s'avance dans l'eau sur sa longueur, centré sur l'abscisse x :
 * vers le bas (dir = -1) depuis le quai, vers le haut (dir = 1) depuis la panne d'en face.
 */
export interface Catway {
  /** abscisse de l'axe (m, repère monde) */
  x: number;
  /** demi-largeur (m) */
  halfWidth: number;
  /** longueur depuis son pied (m) */
  length: number;
  /** ordonnée du pied : bord du quai (0) ou de la panne d'en face (m, repère monde) */
  y: number;
  /** sens dans lequel il s'avance dans l'eau depuis son pied : -1 vers le bas, 1 vers le haut */
  dir: 1 | -1;
}

/**
 * Rangée d'en face, de l'autre côté de l'allée : une panne parallèle au quai, sans fin,
 * des catways qui en montent vers l'allée tous les `pas` mètres, et un bateau immobile de
 * chaque côté de chaque catway, étrave à la panne. Rangée périodique : seuls les éléments
 * proches du bateau sont calculés (`src/sim/enface.ts`).
 */
export interface RangeeEnFace {
  /** abscisse de l'axe d'un des catways ; les autres tous les `pas` mètres (m) */
  x0: number;
  pas: number;
  /** bord de la panne côté allée, pied des catways, et largeur de la panne (m) */
  yPanne: number;
  largeurPanne: number;
  /** catways : demi-largeur et longueur depuis la panne (m) */
  demiLargeurCatway: number;
  longueurCatway: number;
  /** écart entre l'axe d'un catway et celui des bateaux qui le bordent (m) */
  recul: number;
  /** ordonnée du centre des bateaux et leur cap, étrave vers la panne */
  yBateaux: number;
  th: number;
  /** bateaux touchés à la dernière image : abscisse de leur centre et points de contact (repère monde) */
  contacts: { x: number; points: Vec[] }[];
}

/**
 * Sens de rotation de l'hélice, vue de l'arrière en marche avant : à droite
 * (sens des aiguilles d'une montre) ou à gauche.
 */
export type PropHand = 'droite' | 'gauche';

/** Effets avancés activés par la situation ; absents, le comportement de base est inchangé. */
export interface SimOptions {
  /** pas d'hélice et sens de rotation ; absent, pas de pas d'hélice */
  propWalk?: PropHand;
  /**
   * fardage : le vent s'applique en avant du centre quand il vient de l'avant, en arrière
   * quand il vient de l'arrière ; absent, il s'applique au centre. La valeur, tirée au
   * départ de la manœuvre, donne le côté où l'avant abat quand rien d'autre ne le décide :
   * 1 vers bâbord, -1 vers tribord.
   */
  windage?: 1 | -1;
}

export interface SimState {
  /** numéro d'image (60 images par seconde) */
  frame: number;
  body: Body;
  lines: MooringLine[];
  /** position du moteur ; pendant un coup de fouet, celle où il reviendra */
  engine: Engine;
  /** coup de fouet en cours, null sinon */
  kick: Kick | null;
  /** angle de barre (rad), > 0 : le bateau tourne vers bâbord */
  rudder: number;
  wind: Wind;
  /** présence du quai (y > 0) ; faux en situation libre, où le bateau ne touche rien */
  quay: boolean;
  /** points d'appui sur le quai et le catway à la dernière image (repère monde) */
  contacts: Vec[];
  /** catways, immobiles (liste vide le long du quai) */
  catways: Catway[];
  /** rangée d'en face, de l'autre côté de l'allée, ou null sans bateaux en face */
  enFace: RangeeEnFace | null;
  /** bateaux voisins, immobiles (liste vide sans voisin) */
  neighbors: Neighbor[];
  /** position du point de pivot sur l'axe (m, repère bateau), null si le bateau ne tourne pas */
  pivot: number | null;
  /** effets avancés activés, fixés pour toute la manœuvre */
  options: SimOptions;
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
  rudderGrip: number;
  keelLift: number;
  xKeel: number;
  keelShift: number;
  dragXq: number;
  dragXl: number;
  dragYq: number;
  dragYl: number;
  dragYCenter: number;
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
  propWalkRev: number;
  propWalkFwd: number;
  propWalkSpeed: number;
  windageX: number;
  windageShift: number;
  windageSkew: number;
  idleFactor: number;
  kickFactor: number;
  kickTime: number;
  kickMaxTime: number;
  crewEffort: number;
  crewMargin: number;
  crewHold: number;
  haulSpeed: number;
  lineMinLen: number;
}

/** Accumulateur de forces exprimées dans le repère monde, moment autour du centre. */
export interface Forces {
  fx: number;
  fy: number;
  m: number;
}

/** Un effet ajoute sa contribution aux forces. Il peut renseigner l'état (tensions, contacts). */
export type Effect = (s: SimState, p: Params, f: Forces) => void;
