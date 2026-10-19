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
  // Poussée de manœuvre de port (#44) : le bateau libre plafonne vers 3 nœuds en avant, 2,5 en arrière.
  thrustFwd: 1375, // poussée en marche avant (N)
  thrustRev: 935, // poussée en marche arrière (N)
  xProp: -3.4, // position de l'hélice (m)
  xRudder: -4.3, // position du safran (m)
  rudderWash: 0.7, // efficacité du flux d'hélice sur le safran
  rudderFlow: 900, // efficacité de l'erre sur le safran
  rudderGrip: 0.5, // résistance du safran au dérapage de l'arrière
  keelLift: 5000, // portance de la quille contre le dérapage
  xKeel: 0.3, // position de la quille (m)
  keelShift: 1.2, // déplacement du centre de poussée vers l'extrémité qui ouvre la route (m)
  dragXq: 420,
  dragXl: 180,
  dragYq: 4500, // résistance latérale répartie (plan anti-dérive), seule à l'arrêt
  dragYl: 2600,
  dragYCenter: 1, // concentration de la résistance latérale vers le milieu (0 à 1)
  yawL: 2000, // amortissement de lacet propre, en plus de la résistance latérale
  // Vent abaissé un peu moins que la poussée : à faible vitesse, la résistance latérale est
  // surtout linéaire, et le vent doit garder son poids face au moteur.
  windFaible: 300, // force du vent par le travers (N)
  windSoutenu: 900,
  windLongRatio: 0.35,
  lineK: 45000, // raideur des aussières (N/m)
  lineC: 9000,
  contactK: 320000,
  contactC: 30000,
  contactMu: 0.35,
  contactCt: 40000,
  propWalkRev: 440, // pas d'hélice en marche arrière, bateau arrêté (N, à l'hélice)
  propWalkFwd: 66, // pas d'hélice en marche avant, dans l'autre sens (N) ; tous deux suivent la poussée
  propWalkSpeed: 0.8, // erre (m/s) à laquelle le pas d'hélice est divisé par deux
  // Fardage (#12) : point d'application du vent le long de l'axe, windageX + windageShift × cos(angle
  // d'où vient le vent, compté depuis l'étrave) : vers l'avant vent de face, vers l'arrière vent arrière.
  windageX: 0.5, // décalage vers l'avant, vent par le travers (m)
  windageShift: 4, // déplacement vers le bout d'où vient le vent (m)
  windageSkew: 0.07, // écart du vent vu par le fardage, côté tiré au départ (rad, environ 4°)
  idleFactor: 0.5, // ralenti (#67) : poussée multipliée (flux d'hélice et pas d'hélice compris)
  kickFactor: 2, // coup de fouet : poussée multipliée (flux d'hélice et pas d'hélice compris)
  kickTime: 2, // coup de fouet depuis le neutre ou dans le sens du moteur : durée (s)
  kickMaxTime: 5, // coup de fouet à contre-sens, qui casse l'erre : durée maximale (s)
  // Équipier qui tient le bout d'une aussière (#22) : il la reprend tant que la tension reste
  // sous son effort, et lâche quand le bateau tire au-delà, marge comprise.
  crewEffort: 600, // effort de l'équipier (N)
  crewMargin: 0.25, // marge au-dessus de l'effort avant qu'il lâche (fraction de l'effort)
  crewHold: 0.5, // temps de lissage de la tension ressentie : l'équipier encaisse un à-coup bref (s)
  haulSpeed: 0.3, // vitesse de reprise, à la main (m/s)
  lineMinLen: 1, // longueur minimale d'une aussière reprise : taquet contre la bitte (m)
});

/** Pas d'intégration (s) et nombre de sous-pas par image de 1/60 s. */
export const DT = 1 / 240;
export const SUBSTEPS = 4;
export const FPS = 60;
