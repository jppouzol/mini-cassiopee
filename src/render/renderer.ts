import type { Body, MooringLine, SimState, Vec } from '../sim/types.ts';
import { HULL, pointVelocity, toWorld } from '../sim/geometry.ts';
import { CADRAGE_DEFAUT, bornerCadrage, echelleDefaut, longueurEchelle, type Cadrage } from './cadrage.ts';

export interface Palette {
  water: string; grid: string; quay: string; quayEdge: string; bollard: string;
  hull: string; hullEdge: string; accent: string; taut: string; slack: string;
  ink: string; muted: string; ghost: string; neighbor: string; alert: string;
}

export interface View {
  width: number;
  height: number;
  dpr: number;
  palette: Palette;
  labelFont: string;
  /** position de départ à afficher en pointillés, ou null */
  ghost: Body | null;
  debug: boolean;
  /** bittes où l'on peut tourner une aussière (quai et catway du bateau), dessinées même sans aussière */
  bollards: Vec[];
  /** autres bittes, dessinées estompées mais jamais proposées (celles de l'autre catway) */
  otherBollards: Vec[];
  /** édition des aussières en préparation, ou null */
  edition: EditionView | null;
  /** zoom choisi par l'élève, relatif au cadrage par défaut */
  cadrage: Cadrage;
}

/** Ce que le rendu montre pendant l'édition des aussières. */
export interface EditionView {
  /** taquets proposés, en repère bateau */
  cleats: { name: string; pos: Vec }[];
  /** taquet sélectionné, en attente d'une bitte */
  selected: string | null;
}

/** Projection entre le repère monde (m) et l'écran (px CSS). */
export interface Camera {
  /** pixels par mètre */
  sc: number;
  /** pixels par mètre du cadrage par défaut : tailles à l'écran qui ne grossissent pas avec le zoom */
  sc0: number;
  X: (x: number) => number;
  Y: (y: number) => number;
  /** point écran vers point monde */
  toWorld: (px: number, py: number) => Vec;
}

/** Rayon des cibles tactiles de l'éditeur (px CSS) : 44 px de diamètre au moins. */
export const TOUCH_RADIUS = 22;

/** Seuil au-delà duquel une aussière est affichée comme tendue (N). */
export const TAUT_THRESHOLD = 30;

const fmt = (n: number): string => n.toFixed(1).replace('.', ',');

/** Vitesse d'éloignement du taquet au-delà de laquelle une aussière choquée est montrée qui file (m/s). */
export const VITESSE_FILE = 0.02;

/**
 * Vrai quand une aussière choquée s'allonge à cette image : attachée et choquée, tendue
 * jusqu'à sa longueur (à 5 cm près) et taquet qui s'éloigne de la bitte. Le rendu y dessine
 * un chevron tourné vers la bitte. Fonction de l'état seul, sans mémoire.
 */
export function fileEnCeMoment(b: Body, l: Readonly<MooringLine>): boolean {
  if (!l.attached || !l.payingOut) return false;
  const p = toWorld(b, l.cleat);
  const dx = p[0] - l.bollard[0], dy = p[1] - l.bollard[1];
  const d = Math.hypot(dx, dy);
  if (d === 0 || d < l.len - 0.05) return false;
  const v = pointVelocity(b, l.cleat);
  return (v[0] * dx + v[1] * dy) / d > VITESSE_FILE;
}

/** Lit la palette dans les variables CSS du thème courant. */
export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const g = (n: string) => cs.getPropertyValue(n).trim();
  return {
    water: g('--water'), grid: g('--water-grid'), quay: g('--quay'), quayEdge: g('--quay-edge'),
    bollard: g('--bollard'), hull: g('--hull'), hullEdge: g('--hull-edge'), accent: g('--accent'),
    taut: g('--taut'), slack: g('--slack'), ink: g('--ink'), muted: g('--muted'), ghost: g('--ghost'),
    neighbor: g('--neighbor'), alert: g('--alert'),
  };
}

/**
 * Marge laissée au bateau en situation libre, entre son centre et le bord de la vue (m) :
 * sa demi-longueur et un mètre d'eau, pour qu'il reste entier à l'écran.
 */
export const MARGE_LIBRE = 6;

/**
 * Caméra : quai en haut, on suit le bateau quand il s'éloigne. Le cadrage de l'élève (zoom et décalage)
 * s'ajoute au cadrage par défaut, qui continue de suivre le bateau. Sans quai (situation libre), la vue
 * est centrée sur l'origine, où part le bateau, et n'est recalée que quand le bateau approche d'un bord.
 */
export function camera(s: Readonly<SimState>, W: number, H: number, cadrage: Cadrage = CADRAGE_DEFAUT): Camera & { cx: number; cy: number; halfW: number; halfH: number } {
  const b = s.body;
  const sc0 = echelleDefaut(W, H);
  const halfW0 = W / 2 / sc0, halfH0 = H / 2 / sc0;
  let cx = 0;
  let cy = 3.2 - halfH0;
  if (!s.quay) {
    // Libre : la vue ne bouge que si le centre du bateau sort de la zone centrale.
    cy = 0;
    const lx = Math.max(0, halfW0 - MARGE_LIBRE), ly = Math.max(0, halfH0 - MARGE_LIBRE);
    cx = Math.min(b.x + lx, Math.max(b.x - lx, cx));
    cy = Math.min(b.y + ly, Math.max(b.y - ly, cy));
  } else {
    const mx = halfW0 * 0.55;
    if (b.x - cx > mx) cx = b.x - mx; else if (cx - b.x > mx) cx = b.x + mx;
    const lowY = cy - halfH0 * 0.45;
    if (b.y < lowY) cy += b.y - lowY;
  }
  const z = bornerCadrage(cadrage, W, H);
  const sc = sc0 * z.k;
  cx += z.ox;
  cy += z.oy;
  const halfW = W / 2 / sc, halfH = H / 2 / sc;
  return {
    sc, sc0, cx, cy, halfW, halfH,
    X: (x: number) => W / 2 + (x - cx) * sc,
    Y: (y: number) => H / 2 - (y - cy) * sc,
    toWorld: (px: number, py: number): Vec => [cx + (px - W / 2) / sc, cy - (py - H / 2) / sc],
  };
}

/** Dessine la scène. Fonction sans effet sur la simulation. */
export function render(ctx: CanvasRenderingContext2D, s: Readonly<SimState>, v: View): void {
  const { width: W, height: H, palette: C } = v;
  if (W <= 0 || H <= 0) return;
  const b = s.body;
  const { sc, sc0, cx, cy, halfW, halfH, X, Y } = camera(s, W, H, v.cadrage);

  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.fillStyle = C.water;
  ctx.fillRect(0, 0, W, H);

  // Quadrillage de 5 m
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.floor((cx - halfW) / 5) * 5; x < cx + halfW; x += 5) { ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); }
  for (let y = Math.floor((cy - halfH) / 5) * 5; y < cy + halfH; y += 5) { ctx.moveTo(0, Y(y)); ctx.lineTo(W, Y(y)); }
  ctx.stroke();

  // Quai, sauf en situation libre : le quadrillage de l'eau reste le seul repère.
  if (s.quay) {
    ctx.fillStyle = C.quay;
    ctx.fillRect(0, 0, W, Y(0));
    ctx.strokeStyle = C.quayEdge;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke();
    ctx.fillStyle = C.quayEdge;
    ctx.font = `600 12px ${v.labelFont}`;
    ctx.textAlign = 'right';
    // Libellé au-dessus de la rangée de bittes, pour ne pas la chevaucher.
    const yRow = v.bollards.length ? Y(v.bollards[0][1]) - Math.max(3, 0.22 * sc0) - 6 : Y(0) - 8;
    ctx.fillText('QUAI', W - 12, Math.max(14, yRow));
  }

  // Catways : pontons accrochés au quai, de la couleur du quai, bordés sur leurs flancs et leur bout.
  for (const c of s.catways) {
    const xa = X(c.x - c.halfWidth), xb = X(c.x + c.halfWidth), yt = Y(-c.length);
    ctx.fillStyle = C.quay;
    ctx.fillRect(xa, Y(0) - 1, xb - xa, yt - Y(0) + 1);
    ctx.strokeStyle = C.quayEdge;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xa, Y(0)); ctx.lineTo(xa, yt); ctx.lineTo(xb, yt); ctx.lineTo(xb, Y(0)); ctx.stroke();
    // Libellé le long du catway, du côté opposé au bateau, pour ne pas passer sous la coque.
    // Si un voisin occupe ce côté, le libellé passe sur le catway, entre le quai et la première bitte.
    const cote = b.x >= c.x ? -1 : 1;
    const voisinDeCeCote = s.neighbors.some((nb) => Math.sign(nb.x - c.x) === cote && Math.abs(nb.x - c.x) < c.halfWidth + 4);
    ctx.save();
    if (voisinDeCeCote) ctx.translate(X(c.x), Y(-c.length / 4));
    else ctx.translate(X(c.x + cote * (c.halfWidth + 0.5)), Y(-c.length / 2));
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = C.quayEdge;
    ctx.font = `600 11px ${v.labelFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CATWAY', 0, 0);
    ctx.restore();
  }

  // Bittes : pleines si une aussière y est tournée, estompées sinon.
  // Pendant l'édition, un taquet sélectionné met en évidence les bittes où l'on peut tourner l'aussière.
  const used = new Set(s.lines.filter((l) => l.attached).map((l) => l.bollard.join(',')));
  const choosing = v.edition !== null && v.edition.selected !== null;
  // Rayon tiré de l'échelle par défaut : les bittes gardent leur taille à l'écran quand on zoome.
  const rBollard = Math.max(3, 0.22 * sc0);
  ctx.fillStyle = C.bollard;
  ctx.globalAlpha = 0.35;
  for (const p of v.otherBollards) {
    ctx.beginPath();
    ctx.arc(X(p[0]), Y(p[1]), rBollard, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const p of v.bollards) {
    const px = X(p[0]), py = Y(p[1]);
    if (px < -TOUCH_RADIUS || px > W + TOUCH_RADIUS) continue;
    if (choosing) {
      ctx.beginPath();
      ctx.arc(px, py, Math.max(rBollard + 5, 11), 0, Math.PI * 2);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(px, py, rBollard, 0, Math.PI * 2);
    ctx.globalAlpha = used.has(p.join(',')) || choosing ? 1 : 0.35;
    ctx.fillStyle = C.bollard;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const hullPath = (body: Pick<Body, 'x' | 'y' | 'th'>) => {
    ctx.beginPath();
    HULL.forEach((p, i) => {
      const w = toWorld(body, p);
      if (i) ctx.lineTo(X(w[0]), Y(w[1])); else ctx.moveTo(X(w[0]), Y(w[1]));
    });
    ctx.closePath();
  };

  // Bateaux voisins, immobiles : estompés, et contour d'alerte tant que le bateau les touche.
  for (const nb of s.neighbors) {
    const touched = nb.contacts.length > 0;
    hullPath(nb);
    ctx.fillStyle = C.neighbor;
    ctx.fill();
    ctx.strokeStyle = touched ? C.alert : C.slack;
    ctx.lineWidth = touched ? 3 : 1.4;
    ctx.stroke();
  }

  // Position de départ
  if (v.ghost) {
    hullPath(v.ghost);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = C.ghost;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Coque et axe
  hullPath(b);
  ctx.fillStyle = C.hull;
  ctx.fill();
  ctx.strokeStyle = C.hullEdge;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const a1 = toWorld(b, [4.6, 0]), a2 = toWorld(b, [-4.8, 0]);
  ctx.strokeStyle = C.slack;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(X(a1[0]), Y(a1[1])); ctx.lineTo(X(a2[0]), Y(a2[1])); ctx.stroke();
  ctx.setLineDash([]);

  // Safran
  const r0 = toWorld(b, [-5, 0]);
  const r1 = toWorld(b, [-5 - 0.9 * Math.cos(s.rudder), 0.9 * Math.sin(s.rudder)]);
  ctx.strokeStyle = C.hullEdge;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X(r0[0]), Y(r0[1])); ctx.lineTo(X(r1[0]), Y(r1[1])); ctx.stroke();
  ctx.lineCap = 'butt';

  // Poussée du moteur : plus courte et plus fine au ralenti ; pendant un coup de fouet, dans le
  // sens du coup, plus longue et plus épaisse.
  const dir = s.kick ? s.kick.dir : Math.sign(s.engine);
  if (dir !== 0) {
    const fort = s.kick !== null;
    const ralenti = !fort && Math.abs(s.engine) === 0.5;
    const p0 = toWorld(b, [dir > 0 ? -3.6 : -4.2, 0]);
    const p1 = toWorld(b, [dir > 0 ? (fort ? 0.6 : ralenti ? -2.2 : -1.2) : (fort ? -9 : ralenti ? -5.8 : -7), 0]);
    arrow(ctx, X(p0[0]), Y(p0[1]), X(p1[0]), Y(p1[1]), C.accent, fort ? 6 : ralenti ? 2 : 3, fort ? 15 : ralenti ? 8 : 10);
  }

  // Taquets
  ctx.fillStyle = C.hullEdge;
  for (const l of s.lines) {
    const p = toWorld(b, l.cleat);
    ctx.fillRect(X(p[0]) - 2.5, Y(p[1]) - 2.5, 5, 5);
  }
  // Taquets proposés par l'éditeur : un anneau, plein quand il est sélectionné.
  if (v.edition) {
    for (const c of v.edition.cleats) {
      const p = toWorld(b, c.pos);
      const sel = c.name === v.edition.selected;
      ctx.beginPath();
      ctx.arc(X(p[0]), Y(p[1]), sel ? 9 : 8, 0, Math.PI * 2);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = sel ? 3 : 2;
      ctx.stroke();
      if (sel) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = C.accent;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Aussières : rouges tendues, grises molles (avec du ballant)
  for (const l of s.lines) {
    if (!l.attached) continue;
    const p = toWorld(b, l.cleat), q = l.bollard;
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const taut = l.tension > TAUT_THRESHOLD;
    ctx.strokeStyle = taut ? C.taut : C.slack;
    ctx.lineWidth = taut ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(X(p[0]), Y(p[1]));
    if (!taut && l.len > d + 0.01 && d > 0) {
      const sag = Math.min(1.5, Math.sqrt(l.len * l.len - d * d) / 2);
      let nx = -(q[1] - p[1]) / d, ny = (q[0] - p[0]) / d;
      if (ny > 0) { nx = -nx; ny = -ny; }
      ctx.quadraticCurveTo(X((p[0] + q[0]) / 2 + nx * sag), Y((p[1] + q[1]) / 2 + ny * sag), X(q[0]), Y(q[1]));
    } else {
      ctx.lineTo(X(q[0]), Y(q[1]));
    }
    ctx.stroke();
    // Aussière qui file : petit chevron de sa couleur, au quart du trait côté taquet, tourné vers la bitte.
    if (d > 0 && fileEnCeMoment(b, l)) {
      const ux = (X(q[0]) - X(p[0])), uy = (Y(q[1]) - Y(p[1]));
      const n = Math.hypot(ux, uy);
      if (n > 24) {
        const cx = X(p[0]) + ux * 0.25, cy = Y(p[1]) + uy * 0.25;
        const ex = ux / n, ey = uy / n;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - ex * 4 - ey * 5, cy - ey * 4 + ex * 5);
        ctx.lineTo(cx + ex * 2, cy + ey * 2);
        ctx.lineTo(cx - ex * 4 + ey * 5, cy - ey * 4 - ex * 5);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
      }
    }
    if (v.debug && taut) {
      ctx.fillStyle = C.ink;
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(l.tension)} N`, X((p[0] + q[0]) / 2), Y((p[1] + q[1]) / 2) - 6);
    }
  }

  // Appuis sur le quai
  ctx.fillStyle = C.ink;
  for (const c of s.contacts) {
    ctx.beginPath();
    ctx.arc(X(c[0]), Y(Math.min(c[1], 0)), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Contacts avec un voisin : un anneau d'alerte autour du point touché.
  ctx.strokeStyle = C.alert;
  ctx.fillStyle = C.alert;
  ctx.lineWidth = 2;
  for (const nb of s.neighbors) {
    for (const c of nb.contacts) {
      ctx.beginPath();
      ctx.arc(X(c[0]), Y(c[1]), 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(X(c[0]), Y(c[1]), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Point de pivot et flèche de rotation à l'extrémité opposée
  if (s.pivot !== null) {
    const xp = s.pivot;
    const P = toWorld(b, [xp, 0]);
    const far = xp >= 0 ? -5 : 5;
    const rad = Math.abs(far - xp) + 0.7;
    const a0 = b.th + (far < xp ? Math.PI : 0);
    const dir = Math.sign(b.w);
    const pts: Vec[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = a0 + dir * (-0.12 + (0.34 * i) / 16);
      pts.push([X(P[0] + rad * Math.cos(a)), Y(P[1] + rad * Math.sin(a))]);
    }
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    const e1 = pts[pts.length - 2], e2 = pts[pts.length - 1];
    arrowHead(ctx, e1[0], e1[1], e2[0], e2[1], C.accent, 11);
    ctx.beginPath(); ctx.arc(X(P[0]), Y(P[1]), 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(P[0]), Y(P[1]), 3, 0, Math.PI * 2); ctx.fillStyle = C.accent; ctx.fill();
  }

  // Vent, en bas à droite en face de l'échelle : la rangée de bateaux le long du quai reste dégagée.
  const ox = W - 56, oy = H - 52;
  ctx.textAlign = 'center';
  ctx.font = `600 12px ${v.labelFont}`;
  if (s.wind.force === 'aucun') {
    ctx.fillStyle = C.muted;
    ctx.fillText('PAS DE VENT', ox, oy);
  } else {
    const [dx, dy] = s.wind.to;
    const len = 30;
    arrow(ctx, ox - (dx * len) / 2, oy + (dy * len) / 2, ox + (dx * len) / 2, oy - (dy * len) / 2, C.ink, s.wind.force === 'soutenu' ? 4 : 2);
    ctx.fillStyle = C.ink;
    ctx.fillText(`VENT ${s.wind.force.toUpperCase()}`, ox, oy + 34);
  }

  // Échelle : raccourcie quand on zoome (5, 2 ou 1 m), pour tenir dans son coin.
  const lEch = longueurEchelle(sc / sc0);
  const sx = 14, sy = H - 16;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy); ctx.lineTo(sx + lEch * sc, sy); ctx.lineTo(sx + lEch * sc, sy - 5);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.fillText(`${lEch} m`, sx + lEch * sc + 6, sy);

  if (v.debug) {
    const speed = Math.hypot(b.vx, b.vy);
    const rows = [
      `cap ${fmt((b.th * 180) / Math.PI)}°`,
      `vitesse ${(speed * 1.944).toFixed(2)} nd`,
      `lacet ${((b.w * 180) / Math.PI).toFixed(1)}°/s`,
      `pivot ${s.pivot === null ? '—' : `${fmt(s.pivot)} m`}`,
    ];
    ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    rows.forEach((t, i) => ctx.fillText(t, 12, H - 34 - (rows.length - 1 - i) * 15));
  }
}

function arrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, col: string, size: number): void {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x2 + Math.cos(a) * 2, y2 + Math.sin(a) * 2);
  ctx.lineTo(x2 - size * Math.cos(a - 0.45), y2 - size * Math.sin(a - 0.45));
  ctx.lineTo(x2 - size * Math.cos(a + 0.45), y2 - size * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, col: string, w: number, head = 10): void {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  arrowHead(ctx, x1, y1, x2, y2, col, head);
}
