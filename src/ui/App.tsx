import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Session, type Action } from '../session/session.ts';
import { buildState } from '../situations/build.ts';
import { CATALOGUE, GROUPES } from '../situations/catalogue.ts';
import {
  ECARTS_VOISIN, EditionError, PAS_DEPLACEMENT, ajouterAussiere, basculerFile, basculerMou, bornesDeplacement,
  changerBord, deplacerBateau, ecartVoisin, etraveVoisinCatway, reglerFardage, reglerPasHelice, reglerPlafond, reglerVoisin, renommerAussiere, supprimerAussiere, taquetsProposes,
} from '../situations/edit.ts';
import { bitteDepuisPoint, bittesAutresCatways, bittesDuPort, libre, perpendiculaire } from '../situations/quai.ts';
import {
  PLAFOND_DEFAUT, PLAFOND_MAX, cotesVoisin, directionsVent, plafond,
  type Cleat, type CoteVoisin, type SensHelice, type Situation, type WindDirection,
} from '../situations/schema.ts';
import { DEFAULT_PARAMS, FPS } from '../sim/params.ts';
import type { Engine, Params } from '../sim/types.ts';
import { TAUT_THRESHOLD, type EditionView } from '../render/renderer.ts';
import { Scene, type Pick } from './Scene.tsx';
import { Tuning } from './Tuning.tsx';
import { cranSuivant, ecrireMoteurEtendu, etenduForce, lireMoteurEtendu } from './moteur.ts';
import { CRANS, amarresForcees, cranDe, cranVoisin, ecrireAmarresEtendues, lireAmarresEtendues, type Cran } from './amarres.ts';

type WindSetting = Situation['vent'];

/** Choix du pas d'hélice dans les options avancées ; « aucun » est la valeur vide. */
const PAS_HELICE: { value: SensHelice | ''; label: string }[] = [
  { value: '', label: 'Aucun' },
  { value: 'droite', label: 'Hélice à droite' },
  { value: 'gauche', label: 'Hélice à gauche' },
];

/**
 * Côté où l'avant abat sous l'effet du fardage quand rien d'autre n'en décide : tiré à chaque
 * préparation, il change d'un essai à l'autre ; noté dans l'état de départ, il est rejoué à
 * l'identique (retour arrière, ⏮). Seul tirage au hasard de l'application, hors du moteur.
 */
const tirerAbattee = (): 1 | -1 => (Math.random() < 0.5 ? 1 : -1);

const WIND_LABELS: Record<WindDirection, string> = {
  quai: 'Vent du quai',
  large: 'Vent du large',
  avant: "Vent de l'avant",
  arriere: "Vent de l'arrière",
  'quai-avant': "Du quai, de l'avant",
  'quai-arriere': "Du quai, de l'arrière",
  'large-avant': "Du large, de l'avant",
  'large-arriere': "Du large, de l'arrière",
  catway: 'Vent du catway',
  chenal: 'Vent du chenal',
  'catway-quai': 'Du catway, du quai',
  'catway-chenal': 'Du catway, du chenal',
  'large-quai': 'Du large, du quai',
  'large-chenal': 'Du large, du chenal',
  babord: 'Vent de bâbord',
  tribord: 'Vent de tribord',
  'avant-babord': "De l'avant, de bâbord",
  'avant-tribord': "De l'avant, de tribord",
  'arriere-babord': "De l'arrière, de bâbord",
  'arriere-tribord': "De l'arrière, de tribord",
};
const FORCES: { value: WindSetting['force']; label: string }[] = [
  { value: 'aucun', label: 'Pas de vent' },
  { value: 'faible', label: 'Faible' },
  { value: 'soutenu', label: 'Soutenu' },
];
/** Familles du catalogue, selon le type d'amarrage : le menu ne liste que les situations de la famille choisie. */
const AMARRAGES: { value: Situation['quai']['type']; label: string }[] = [
  { value: 'long-side', label: 'Le long du quai' },
  { value: 'perpendiculaire', label: 'Sur catway' },
  { value: 'libre', label: 'Libre' },
];
/** Bord du bateau tourné vers le quai ou le catway. */
const BORDS: { value: Situation['bateau']['bordAuQuai']; label: string }[] = [
  { value: 'babord', label: 'Bâbord' },
  { value: 'tribord', label: 'Tribord' },
];
/** Commande moteur simplifiée (#73), par défaut : arrière, neutre, avant, sur une rangée. */
const ENGINE_SIMPLE: { value: Engine; label: string }[] = [
  { value: -1, label: 'Arrière' },
  { value: 0, label: 'Neutre' },
  { value: 1, label: 'Avant' },
];
/**
 * Commande moteur étendue, dans l'ordre de `ENGINE_POSITIONS` (ordre du clavier et des lecteurs
 * d'écran). À l'écran, trois colonnes : l'arrière à gauche, l'avant à droite, le ralenti
 * au-dessus de la marche, et le neutre au milieu sur les deux rangées (`.seg.moteur`). On lit
 * ainsi de haut en bas ralenti, marche puis coup de fouet. Chaque position garde son nom
 * complet pour les lecteurs d'écran.
 */
const ENGINE: { value: Engine; label: string; title: string; place: string }[] = [
  { value: -1, label: 'Arrière', title: 'Marche arrière', place: 'marche-ar' },
  { value: -0.5, label: 'Ralenti', title: 'Ralenti arrière', place: 'ralenti-ar' },
  { value: 0, label: 'Neutre', title: 'Neutre', place: 'neutre' },
  { value: 0.5, label: 'Ralenti', title: 'Ralenti avant', place: 'ralenti-av' },
  { value: 1, label: 'Avant', title: 'Marche avant', place: 'marche-av' },
];
/** Coups de fouet, sous la commande moteur : arrière à gauche, avant à droite, comme au-dessus. */
/** Crans de la commande étendue des amarres (#75), dans l'ordre de l'échelle. */
const CRAN_LABELS: Record<Cran, string> = { choquer: 'Choquer', bloquer: 'Bloquer' };
const KICKS: { value: 1 | -1; label: string }[] = [
  { value: -1, label: 'Coup arrière' },
  { value: 1, label: 'Coup avant' },
];
/** Taquet sélectionné, nommé par son bord : bâbord ou tribord selon le flanc tourné vers le quai ou le catway. */
function cleatLabel(sit: Situation, cleat: Cleat): string {
  const auQuai = sit.bateau.bordAuQuai === 'babord' ? 'bâbord' : 'tribord';
  const auLarge = auQuai === 'bâbord' ? 'tribord' : 'bâbord';
  switch (cleat) {
    case 'etrave': return `le taquet d'étrave ${auQuai}`;
    case 'etrave-large': return `le taquet d'étrave ${auLarge}`;
    case 'arriere': return `le taquet arrière ${auQuai}`;
    case 'arriere-large': return `le taquet arrière ${auLarge}`;
    case 'maitre-bau': return `le taquet de maître-bau ${auQuai}`;
    case 'maitre-bau-large': return `le taquet de maître-bau ${auLarge}`;
  }
}
/** Réglages d'un voisin le long du quai : écart compté depuis la place d'origine du bateau. */
const VOISINS: { value: number | null; label: string }[] = [
  { value: null, label: 'Aucun' },
  { value: ECARTS_VOISIN.serre, label: 'Serré' },
  { value: ECARTS_VOISIN.large, label: 'Large' },
];
const COTE_LABELS: Record<CoteVoisin, string> = {
  avant: 'Voisin devant', arriere: 'Voisin derrière', catway: 'Voisin côté catway', large: 'Voisin côté large',
};
const STEP_FRAMES = 12;
const MAX_RUDDER_DEG = 35;

const fmtTime = (frame: number) => `${(frame / FPS).toFixed(1).replace('.', ',')} s`;
const rudderToDeg = (rad: number) => Math.round((-rad * 180) / Math.PI);
const degToRudder = (deg: number) => (-deg * Math.PI) / 180;

export function App() {
  // Situation d'origine (catalogue) et situation préparée par l'élève, point de départ de la session.
  const [origine, setOrigine] = useState<Situation>(CATALOGUE[0]);
  const [preparee, setPreparee] = useState<Situation>(CATALOGUE[0]);
  const [params, setParams] = useState<Params>({ ...DEFAULT_PARAMS });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ghost, setGhost] = useState(false);
  const [debug, setDebug] = useState(false);
  // Commande moteur étendue (ralentis et coups de fouet) : choix de l'élève, gardé dans le navigateur.
  const [moteurEtendu, setMoteurEtenduState] = useState(lireMoteurEtendu);
  const setMoteurEtendu = (v: boolean) => {
    setMoteurEtenduState(v);
    ecrireMoteurEtendu(v);
  };
  // Commande étendue des amarres (crans Choquer et Bloquer) : choix propre aux amarres, gardé dans le navigateur.
  const [amarresEtendues, setAmarresEtenduesState] = useState(lireAmarresEtendues);
  const setAmarresEtendues = (v: boolean) => {
    setAmarresEtenduesState(v);
    ecrireAmarresEtendues(v);
  };
  const [selected, setSelected] = useState<Cleat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [voisinNotice, setVoisinNotice] = useState<string | null>(null);
  const [renaming, setRenamingState] = useState<{ id: string; text: string } | null>(null);
  // Copie synchrone du renommage en cours : Entrée, Échap et la perte de focus peuvent se suivre
  // avant le rendu suivant, et un seul d'entre eux doit agir.
  const renamingRef = useRef<{ id: string; text: string } | null>(null);
  const setRenaming = useCallback((r: { id: string; text: string } | null) => {
    renamingRef.current = r;
    setRenamingState(r);
  }, []);
  const [, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const sessionRef = useRef<Session | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const newSession = useCallback((sit: Situation) => {
    sessionRef.current = new Session(buildState(sit, undefined, tirerAbattee()), paramsRef.current);
    setPlaying(false);
    refresh();
  }, [refresh]);

  if (sessionRef.current === null) sessionRef.current = new Session(buildState(preparee, undefined, tirerAbattee()), params);
  const session = sessionRef.current;
  const s = session.state;
  const atStart = session.frame === 0;
  // Préparation : instant de départ, lecture arrêtée. Seul moment où l'on édite la situation.
  const preparing = atStart && !playing;
  // Moteur au ralenti ou coup de fouet en cours : seule la commande étendue montre cet état.
  const moteurForce = etenduForce(s);
  const etendu = moteurEtendu || moteurForce;
  const etenduRef = useRef(etendu);
  etenduRef.current = etendu;
  // Une aussière qui file (ou réglée pour filer au départ) : seuls les crans montrent cet état.
  const amarresForce = amarresForcees(s.lines);
  const etendues = amarresEtendues || amarresForce;
  const etenduesRef = useRef(etendues);
  etenduesRef.current = etendues;
  const wind = preparee.vent;
  // Amarrage perpendiculaire : le bateau est le long d'un catway, qu'on dessine vertical sous le quai.
  const catway = perpendiculaire(preparee);
  // Situation libre : ni quai, ni aussière, ni voisin ; seuls le vent et le pas d'hélice se règlent.
  const enLibre = libre(preparee);
  const typeQuai = preparee.quai.type;
  // Les rangées de bittes dépendent du bord du bateau tourné vers le catway (côté du second catway).
  const bollards = useMemo(() => bittesDuPort(preparee), [preparee]);
  const otherBollards = useMemo(() => bittesAutresCatways(preparee), [preparee]);
  const support = catway ? 'catway' : 'quai';
  const bitteLabel = catway ? 'une bitte du quai ou du catway' : 'une bitte du quai';

  // Boucle de lecture : avance au rythme de l'affichage, en temps simulé régulier.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += (Math.min(0.1, (now - last) / 1000)) * FPS * speed;
      last = now;
      const n = Math.floor(acc);
      if (n > 0) {
        acc -= n;
        session.advance(n);
        refresh();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, session, refresh]);

  // En quittant la préparation, on abandonne une sélection ou un renommage en cours.
  useEffect(() => {
    if (preparing) return;
    setSelected(null);
    setRenaming(null);
    setNotice(null);
    setVoisinNotice(null);
  }, [preparing, setRenaming]);

  const act = useCallback((a: Action) => { sessionRef.current?.act(a); refresh(); }, [refresh]);
  const seek = useCallback((f: number) => { setPlaying(false); sessionRef.current?.seek(f); refresh(); }, [refresh]);
  const step = useCallback((n: number) => {
    const ses = sessionRef.current;
    if (!ses) return;
    setPlaying(false);
    if (n > 0) ses.advance(n); else ses.seek(ses.frame + n);
    refresh();
  }, [refresh]);

  /**
   * Modifie la situation préparée et repart de cette nouvelle situation (la manœuvre enregistrée est effacée).
   * Un refus de l'éditeur s'affiche près des aussières, ou près du réglage concerné (`onError`).
   */
  const edit = (f: (sit: Situation) => Situation, onError: (msg: string) => void = setNotice) => {
    if (!preparing) return;
    try {
      const next = f(preparee);
      if (next === preparee) return;
      setPreparee(next);
      newSession(next);
      setNotice(null);
      setVoisinNotice(null);
    } catch (e) {
      if (e instanceof EditionError) onError(e.message); else throw e;
    }
  };
  const setVoisin = (cote: CoteVoisin, ecart: number | null) =>
    edit((sit) => reglerVoisin(sit, origine, cote, ecart), setVoisinNotice);
  const changeWind = (w: WindSetting) => edit((sit) => ({ ...sit, vent: w }));
  const changeParams = (p: Params) => {
    setParams(p);
    session.setParams(p);
    refresh();
  };
  const chooseSituation = (sit: Situation) => {
    setOrigine(sit);
    setPreparee(sit);
    setSelected(null);
    setRenaming(null);
    setNotice(null);
    setVoisinNotice(null);
    newSession(sit);
  };

  // Déplacer le bateau le long du support, au doigt (position visée depuis le début du geste) ou par pas.
  // Le long du quai, la position suit x ; le long du catway, elle croît vers le chenal, vers le bas de l'écran.
  const dragFrom = useRef<number | null>(null);
  const onDragStart = () => {
    if (!preparing) return;
    dragFrom.current = preparee.bateau.x;
    setSelected(null);
    setNotice(null);
  };
  const onDrag = (dx: number, dy: number) => {
    const x0 = dragFrom.current;
    if (x0 !== null) edit((sit) => deplacerBateau(sit, origine, x0 + (perpendiculaire(sit) ? -dy : dx)));
  };
  const moveBoat = (sens: 1 | -1) => edit((sit) => deplacerBateau(sit, origine, sit.bateau.x + sens * PAS_DEPLACEMENT));
  // Retourner le bateau : aussières en miroir, vent et voisins fixes dans le port (voir changerBord).
  const chooseBord = (bord: 'babord' | 'tribord') => {
    if (bord === preparee.bateau.bordAuQuai) return;
    setSelected(null);
    edit((sit) => changerBord(sit, origine, bord));
  };
  // Cran d'une aussière : en préparation, elle file ou non dès la mise en mouvement ;
  // ensuite, le changement est noté dans le journal. Rien n'est fait si le cran ne change pas.
  const setCran = (index: number, cran: Cran) => {
    if (preparing) {
      const a = preparee.aussieres[index];
      if (a && (a.file === true) !== (cran === 'choquer')) edit((sit) => basculerFile(sit, a.id));
      return;
    }
    const l = session.state.lines[index];
    if (l && l.attached && cranDe(l) !== cran) act({ type: 'pay-out', lineId: l.id, value: cran === 'choquer' });
  };
  // Clavier : un cran vers Choquer (-1) ou vers Bloquer (1), depuis le cran actuel.
  const stepCran = (index: number, sens: 1 | -1) => {
    const l = session.state.lines[index];
    if (l && l.attached) setCran(index, cranVoisin(cranDe(l), sens));
  };
  // Copies pour les raccourcis clavier, dont l'écouteur n'est pas recréé à chaque rendu.
  const moveBoatRef = useRef(moveBoat);
  moveBoatRef.current = moveBoat;
  const catwayRef = useRef(catway);
  catwayRef.current = catway;
  const stepCranRef = useRef(stepCran);
  stepCranRef.current = stepCran;

  // Toucher sur la scène : un taquet, puis une bitte.
  const onPick = (p: Pick) => {
    if (!preparing) return;
    if (p.kind === 'cleat') {
      const c = p.name as Cleat;
      setSelected((cur) => (cur === c ? null : c));
      setNotice(null);
    } else if (p.kind === 'bollard') {
      if (!selected) {
        setNotice('Touchez d’abord un taquet du bateau, puis la bitte.');
        return;
      }
      const taquet = selected;
      setSelected(null);
      edit((sit) => {
        const a = bitteDepuisPoint(sit, p.p);
        return ajouterAussiere(sit, taquet, a.bitte, a.sur);
      });
    } else {
      setSelected(null);
    }
  };

  const commitRename = () => {
    const r = renamingRef.current;
    if (!r) return;
    setRenaming(null);
    edit((sit) => renommerAussiere(sit, r.id, r.text));
  };

  // Raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.matches('input[type=text]')) return;
      if (t && t.matches('select, input') && !['Space', 'KeyR', 'KeyC'].includes(e.code)) return;
      const ses = sessionRef.current;
      if (!ses) return;
      const cur = ses.state;
      const deg = rudderToDeg(cur.rudder);
      // Maj + flèches : déplacer le bateau pendant la préparation (les flèches seules pilotent),
      // gauche et droite le long du quai, haut (vers le quai) et bas (vers le chenal) le long du catway.
      const [moins, plus] = catwayRef.current ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
      if (e.shiftKey && (e.code === moins || e.code === plus)) {
        moveBoatRef.current(e.code === moins ? -1 : 1);
        e.preventDefault();
        return;
      }
      switch (e.code) {
        case 'Space': setPlaying((p) => !p); break;
        case 'Escape': setSelected(null); setNotice(null); break;
        // Flèches haut et bas : un cran de la commande moteur affichée, ralentis compris en étendu.
        case 'ArrowUp': case 'ArrowDown':
          act({ type: 'engine', value: cranSuivant(cur.engine, e.code === 'ArrowUp' ? 1 : -1, etenduRef.current) });
          break;
        // Coup de fouet, en étendu seulement : la répétition automatique d'une touche maintenue ne relance pas le coup.
        case 'PageUp': if (!e.repeat && etenduRef.current) act({ type: 'kick', value: 1 }); break;
        case 'PageDown': if (!e.repeat && etenduRef.current) act({ type: 'kick', value: -1 }); break;
        case 'ArrowLeft': act({ type: 'rudder', value: degToRudder(Math.max(-MAX_RUDDER_DEG, deg - 5)) }); break;
        case 'ArrowRight': act({ type: 'rudder', value: degToRudder(Math.min(MAX_RUDDER_DEG, deg + 5)) }); break;
        case 'KeyC': act({ type: 'rudder', value: 0 }); break;
        case 'KeyR': seek(0); break;
        case 'Comma': step(-STEP_FRAMES); break;
        case 'Period': step(STEP_FRAMES); break;
        default: {
          // Chiffres de la rangée du haut, repérés par la touche (indépendamment de la disposition du clavier) :
          // le chiffre seul largue une aussière, une fois la manœuvre commencée. Dans la commande
          // étendue des amarres seulement, Maj + chiffre la passe d'un cran vers Choquer, Alt + chiffre
          // d'un cran vers Bloquer (Maj + Alt est écarté : sous Windows, il change la disposition du clavier).
          const m = /^Digit([1-9])$/.exec(e.code);
          if (!m || e.ctrlKey || e.metaKey || (e.shiftKey && e.altKey)) return;
          const n = Number(m[1]);
          const l = cur.lines[n - 1];
          if (e.shiftKey || e.altKey) {
            if (!etenduesRef.current) return;
            stepCranRef.current(n - 1, e.shiftKey ? -1 : 1);
          } else if (l && l.attached && ses.frame > 0) act({ type: 'cast-off', lineId: l.id });
          else return;
        }
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, seek, step]);

  const edition = useMemo<EditionView | null>(
    // En libre, rien à éditer sur la scène : un glisser à la souris y déplace la vue.
    () => (preparing && !enLibre ? { cleats: taquetsProposes(preparee), selected } : null),
    [preparing, enLibre, preparee, selected],
  );
  // Rangée des crans d'une aussière, sous sa rangée principale, dans la commande étendue des amarres.
  const crans = (i: number, name: string, actuel: Cran, actif: boolean) => (
    <div className="seg crans" role="group" aria-label={`Équipier, ${name}`}>
      {CRANS.map((c) => (
        <button key={c} aria-pressed={actif && actuel === c} disabled={!actif}
          title={i < 9 ? `${CRAN_LABELS[c]} (${c === 'choquer' ? 'Maj' : 'Alt'} + ${i + 1})` : CRAN_LABELS[c]}
          onClick={() => setCran(i, c)}>{CRAN_LABELS[c]}</button>
      ))}
    </div>
  );
  const rudderDeg = rudderToDeg(s.rudder);
  const showTuning = typeof location !== 'undefined' && location.hash === '#reglages';
  const max = plafond(preparee);
  const modified = preparee !== origine;
  const [xMin, xMax] = bornesDeplacement(preparee, origine);
  const status = playing
    ? (session.atEnd ? 'Simulation' : 'Relecture')
    : selected ? `Touchez ${bitteLabel}`
    : atStart ? 'Prêt · appuyez sur Lecture' : 'En pause';
  // Options avancées : réglages de départ, affichés seulement en préparation.
  const optionsAvancees = (
    <details>
      <summary>Options avancées</summary>
      <div className="advanced">
        {!enLibre && <>
        <div className="row">
          <span>Aussières au maximum</span>
          <div className="stepper push-right" role="group" aria-label="Plafond d'aussières">
            <button className="btn" disabled={max <= Math.max(PLAFOND_DEFAUT, preparee.aussieres.length)}
              aria-label="Diminuer le plafond" onClick={() => edit((sit) => reglerPlafond(sit, max - 1))}>−</button>
            <output aria-live="polite">{max}</output>
            <button className="btn" disabled={max >= PLAFOND_MAX}
              aria-label="Augmenter le plafond" onClick={() => edit((sit) => reglerPlafond(sit, max + 1))}>+</button>
          </div>
        </div>
        <p className="hint">De {PLAFOND_DEFAUT} à {PLAFOND_MAX}, jamais moins que le nombre d’aussières en place. Se règle au départ.</p>
        {cotesVoisin(preparee.quai.type).map((cote) => {
          const ecart = ecartVoisin(preparee, origine, cote);
          // Sur catway, un voisin est présent ou absent : sa place découle des catways.
          const options = catway
            ? [{ value: null, label: 'Aucun' }, { value: etraveVoisinCatway(origine), label: 'Présent' }]
            : VOISINS;
          const actif = (v: number | null) => (catway ? (ecart !== null) === (v !== null) : ecart === v);
          return (
            <div className="voisin" key={cote}>
              <span>{COTE_LABELS[cote]}</span>
              <div className="seg" role="group" aria-label={COTE_LABELS[cote]}>
                {options.map((o) => (
                  <button key={o.label} aria-pressed={actif(o.value)}
                    onClick={() => setVoisin(cote, o.value)}>{o.label}</button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="hint" aria-live="polite">{voisinNotice ?? (catway
          ? 'Bateaux amarrés étrave au quai, de l’autre côté du catway ou contre le catway voisin, immobiles : le bateau peut s’y appuyer ou les toucher. Se règlent au départ.'
          : 'Bateaux amarrés devant ou derrière, immobiles : le bateau peut s’y appuyer ou les toucher. Se règlent au départ.')}</p>
        </>}
        <div className="row">
          <label htmlFor="pas-helice">Pas d’hélice</label>
          <select id="pas-helice" className="push-right" value={preparee.options?.pasHelice ?? ''}
            onChange={(e) => edit((sit) => reglerPasHelice(sit, (e.target.value || null) as SensHelice | null))}>
            {PAS_HELICE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <p className="hint">Poussée de l’hélice qui fait partir l’arrière de côté quand le moteur tourne, surtout en marche arrière. Se règle au départ.</p>
        <div className="voisin">
          <span>Fardage</span>
          <div className="seg" role="group" aria-label="Fardage">
            {[false, true].map((actif) => (
              <button key={String(actif)} aria-pressed={(preparee.options?.fardage === true) === actif}
                onClick={() => edit((sit) => reglerFardage(sit, actif))}>{actif ? 'Avec' : 'Sans'}</button>
            ))}
          </div>
        </div>
        <p className="hint">Prise au vent de la coque et du gréement, plus forte au bout qui reçoit le vent : vent de face, l’avant abat d’un côté ou de l’autre ; arrêté, le bateau se met en travers. Se règle au départ.</p>
      </div>
    </details>
  );

  return (
    <div className="app">
      <div className="stage">
        <div className="scene">
          <Scene state={s} ghost={ghost ? session.initialState.body : null} debug={debug} bollards={bollards} otherBollards={otherBollards}
            edition={edition} onPick={onPick} onDragStart={onDragStart} onDrag={onDrag} cadrageCle={origine.id} />
          <div className="badge">{status}</div>
        </div>
        <div className="player">
          <button className="btn" onClick={() => seek(0)} title="Revenir au départ (R)" aria-label="Revenir au départ">⏮</button>
          <button className="btn" onClick={() => step(-STEP_FRAMES)} title="Reculer de 0,2 s (,)" aria-label="Reculer de 0,2 s">◀◀</button>
          <button className="btn primary" onClick={() => setPlaying((p) => !p)} title="Lecture ou pause (Espace)">{playing ? 'Pause' : 'Lecture'}</button>
          <button className="btn" onClick={() => step(STEP_FRAMES)} title="Avancer de 0,2 s (.)" aria-label="Avancer de 0,2 s">▶▶</button>
          <input id="timeline" type="range" min={0} max={session.lastFrame} value={session.frame}
            onChange={(e) => seek(Number(e.target.value))} aria-label="Chronologie de la manœuvre" />
          <span className="time">{fmtTime(session.frame)}</span>
          <select id="speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Vitesse de lecture">
            <option value={0.5}>×0,5</option><option value={1}>×1</option><option value={2}>×2</option><option value={4}>×4</option>
          </select>
        </div>
      </div>

      <aside className="panel">
        {preparing && <h1>Mini Cassiopée<small>Manœuvres de port · voilier de 10 m</small></h1>}

        {preparing && (
          <section>
            <h2>Situation</h2>
            <div className="seg" role="group" aria-label="Type d'amarrage">
              {AMARRAGES.map((a) => (
                <button key={a.value} aria-pressed={origine.quai.type === a.value}
                  onClick={() => {
                    // Changer de famille ouvre sa première situation ; rester dans la même ne change rien.
                    if (origine.quai.type === a.value) return;
                    const premiere = CATALOGUE.find((x) => x.quai.type === a.value);
                    if (premiere) chooseSituation(premiere);
                  }}>{a.label}</button>
              ))}
            </div>
            <select id="situation" value={origine.id} aria-label="Situation de départ"
              onChange={(e) => chooseSituation(CATALOGUE.find((x) => x.id === e.target.value) ?? CATALOGUE[0])}>
              {GROUPES.filter((g) => g.type === origine.quai.type).map((g) => (
                <optgroup key={`${g.type}-${g.titre}`} label={g.titre}>
                  {g.situations.map((x) => <option key={x.id} value={x.id}>{x.titre}</option>)}
                </optgroup>
              ))}
            </select>
            <p className="hint">{origine.description}</p>
            {modified && (
              <div className="row">
                <span className="hint">Situation modifiée.</span>
                <button className="btn push-right" onClick={() => chooseSituation(origine)}
                  title="Revenir à la situation telle qu'elle est dans le catalogue">Situation d’origine</button>
              </div>
            )}
            {!enLibre && <>
            <div className="row">
              <span>Bateau le long du {support}</span>
              <div className="stepper push-right" role="group" aria-label={`Position du bateau le long du ${support}`}>
                <button className="btn" disabled={preparee.bateau.x <= xMin}
                  aria-label={catway ? 'Rapprocher le bateau du quai' : 'Déplacer le bateau vers la gauche'}
                  title={catway ? 'Vers le quai (Maj + ↑)' : 'Vers la gauche (Maj + ←)'} onClick={() => moveBoat(-1)}>{catway ? '▲' : '◀'}</button>
                <button className="btn" disabled={preparee.bateau.x >= xMax}
                  aria-label={catway ? 'Éloigner le bateau du quai' : 'Déplacer le bateau vers la droite'}
                  title={catway ? 'Vers le chenal (Maj + ↓)' : 'Vers la droite (Maj + →)'} onClick={() => moveBoat(1)}>{catway ? '▼' : '▶'}</button>
              </div>
            </div>
            <p className="hint">Faites glisser le bateau ou utilisez {catway ? '▲ ▼' : '◀ ▶'} : les aussières restent tournées sur leurs bittes.</p>
            <div className="row">
              <span>Bord au {support}</span>
              <div className="seg seg-court push-right" role="group" aria-label={`Bord du bateau au ${support}`}>
                {BORDS.map((b) => (
                  <button key={b.value} aria-pressed={preparee.bateau.bordAuQuai === b.value}
                    title={`${b.label} au ${support} : le bateau se retourne, ses aussières passent en miroir`}
                    onClick={() => chooseBord(b.value)}>{b.label}</button>
                ))}
              </div>
            </div>
            </>}
            <select id="wind-direction" value={wind.direction} aria-label="Direction du vent"
              onChange={(e) => changeWind({ ...wind, direction: e.target.value as WindDirection })}>
              {directionsVent(typeQuai).map((d) => <option key={d} value={d}>{WIND_LABELS[d]}</option>)}
            </select>
            <div className="seg" role="group" aria-label="Force du vent">
              {FORCES.map((f) => (
                <button key={f.value} aria-pressed={wind.force === f.value}
                  onClick={() => changeWind({ ...wind, force: f.value })}>{f.label}</button>
              ))}
            </div>
            <p className="hint">{enLibre
              ? 'Le vent se règle par rapport au bateau au départ, puis reste fixe : le bateau tourne dedans.'
              : 'Le vent se règle avant le départ et reste fixe pendant la manœuvre.'}</p>
          </section>
        )}

        <section>
          <div className="titre-section">
            <h2>Moteur</h2>
            {/* Interrupteur : imposé tant que le moteur est au ralenti ou qu'un coup de fouet est en cours. */}
            <button className="interrupteur" role="switch" aria-checked={etendu} disabled={moteurForce}
              title={moteurForce ? 'Le moteur est au ralenti ou en coup de fouet' : 'Ralenti et coup de fouet'}
              onClick={() => setMoteurEtendu(!moteurEtendu)}>
              <span className="piste" aria-hidden="true"><span className="curseur" /></span>Étendue
            </button>
          </div>
          {etendu ? <>
            <div className="seg moteur" role="group" aria-label="Moteur">
              {ENGINE.map((m) => (
                <button key={m.value} className={m.place} aria-pressed={s.engine === m.value} aria-label={m.title} title={m.title}
                  onClick={() => act({ type: 'engine', value: m.value })}>{m.label}</button>
              ))}
            </div>
            <div className="seg coups" role="group" aria-label="Coup de fouet">
              {KICKS.map((k) => (
                <button key={k.value} aria-pressed={s.kick?.dir === k.value}
                  onClick={() => act({ type: 'kick', value: k.value })}>{k.label}</button>
              ))}
            </div>
            {preparing && <p className="hint">Ralenti : moitié de la poussée. Coup de fouet : poussée brève et forte, puis le moteur revient de lui-même.</p>}
          </> : (
            <div className="seg moteur-simple" role="group" aria-label="Moteur">
              {ENGINE_SIMPLE.map((m) => (
                <button key={m.value} aria-pressed={s.engine === m.value}
                  onClick={() => act({ type: 'engine', value: m.value })}>{m.label}</button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2>Barre</h2>
          <div className="helm">
            <span>Bâbord</span>
            <input id="helm" type="range" min={-MAX_RUDDER_DEG} max={MAX_RUDDER_DEG} step={1} value={rudderDeg}
              onChange={(e) => act({ type: 'rudder', value: degToRudder(Number(e.target.value)) })} aria-label="Angle de barre" />
            <span>Tribord</span>
          </div>
          <div className="row">
            <span className="hint">{rudderDeg === 0 ? 'Barre au centre' : `${rudderDeg < 0 ? 'Bâbord' : 'Tribord'} ${Math.abs(rudderDeg)}°`}</span>
            <button className="btn push-right" onClick={() => act({ type: 'rudder', value: 0 })}>Centrer</button>
          </div>
          {preparing && <p className="hint">Barre à roue : le bateau tourne du côté choisi.</p>}
        </section>

        {!enLibre && <section>
          <div className="titre-section">
            <h2>Amarres</h2>
            {preparing && <span className="count push-right">{preparee.aussieres.length} / {max}</span>}
            {/* Interrupteur propre aux amarres : imposé tant qu'une aussière non larguée n'est pas sur Bloquer. */}
            <button className="interrupteur" role="switch" aria-checked={etendues} disabled={amarresForce}
              title={amarresForce ? 'Une aussière n’est pas sur Bloquer' : 'Choquer ou bloquer chaque aussière'}
              onClick={() => setAmarresEtendues(!amarresEtendues)}>
              <span className="piste" aria-hidden="true"><span className="curseur" /></span>Étendue
            </button>
          </div>
          <div className="lines">
            {s.lines.length === 0 && <p className="hint">Aucune amarre dans cette situation.</p>}
            {preparing
              ? preparee.aussieres.map((a, i) => {
                const name = s.lines[i]?.name ?? '';
                const molle = a.mou > 0;
                return (
                  <div className="line" key={a.id}>
                    <span className={`chip ${molle ? 'slack' : 'taut'}`} />
                    {renaming?.id === a.id
                      ? <input type="text" className="rename" value={renaming.text} maxLength={40} autoFocus
                          aria-label={`Nouveau nom pour ${name}`} placeholder="Nom déduit"
                          onChange={(e) => setRenaming({ id: a.id, text: e.target.value })}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setRenaming(null);
                          }} />
                      : <button className="name" title="Renommer" aria-label={`${name}, renommer`}
                          onClick={() => setRenaming({ id: a.id, text: a.nom ?? '' })}>{name} <span aria-hidden="true">✎</span></button>}
                    <button className="btn" aria-pressed={molle} title="Basculer entre tendue et molle"
                      onClick={() => edit((sit) => basculerMou(sit, a.id))}>{molle ? 'Molle' : 'Tendue'}</button>
                    <button className="btn" onClick={() => edit((sit) => supprimerAussiere(sit, a.id))}>Supprimer</button>
                    {etendues && crans(i, name, a.file === true ? 'choquer' : 'bloquer', true)}
                  </div>
                );
              })
              : s.lines.map((l, i) => {
                const state = !l.attached ? 'gone' : l.tension > TAUT_THRESHOLD ? 'taut' : 'slack';
                const label = state === 'gone' ? 'Larguée'
                  : l.payingOut ? 'File'
                  : state === 'taut' ? (debug ? `${Math.round(l.tension)} N` : 'Tendue') : 'Molle';
                return (
                  <div className="line" key={l.id}>
                    <span className={`chip ${state}`} />
                    <span className="name-text">{l.name}</span>
                    <span className="state">{label}</span>
                    <button className="btn" disabled={!l.attached} title={i < 9 ? `Touche ${i + 1}` : undefined}
                      onClick={() => act({ type: 'cast-off', lineId: l.id })}>Larguer</button>
                    {etendues && crans(i, l.name, cranDe(l), l.attached)}
                  </div>
                );
              })}
          </div>
          {preparing && etendues && <p className="hint">Les crans règlent ce que fait l’équipier dès la mise en mouvement.</p>}
          {preparing && (
            <p className="hint" aria-live="polite">
              {notice
                ?? (selected
                  ? `Touchez ${bitteLabel} pour y tourner l’aussière depuis ${cleatLabel(preparee, selected)}.`
                  : `Pour ajouter une aussière, touchez un taquet du bateau (cercle bleu), puis ${bitteLabel}.`)}
            </p>
          )}
        </section>}

        <section>
          <h2>Affichage</h2>
          <label className="check"><input id="ghost" type="checkbox" checked={ghost} onChange={(e) => setGhost(e.target.checked)} /> Position de départ</label>
          <label className="check"><input id="debug" type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> Valeurs de mise au point</label>
        </section>

        {preparing && optionsAvancees}

        {showTuning && <Tuning params={params} onChange={changeParams} />}

        <p className="keys">
          <kbd>Espace</kbd> lecture · <kbd>↑</kbd><kbd>↓</kbd> moteur · {etendu && <><kbd>Page ↑</kbd><kbd>Page ↓</kbd> coup de fouet · </>}<kbd>←</kbd><kbd>→</kbd> barre · <kbd>C</kbd> centrer ·
          {!enLibre && <>
          {' '}<kbd>Maj</kbd>+{catway ? <><kbd>↑</kbd><kbd>↓</kbd></> : <><kbd>←</kbd><kbd>→</kbd></>} bateau ·
          {' '}<kbd>1</kbd>–<kbd>9</kbd> larguer ·
          {etendues && <>{' '}<kbd>Maj</kbd>+<kbd>1</kbd>–<kbd>9</kbd> choquer · <kbd>Alt</kbd>+<kbd>1</kbd>–<kbd>9</kbd> bloquer ·</>}
          </>}
          {' '}<kbd>,</kbd><kbd>.</kbd> pas à pas · <kbd>R</kbd> départ{!enLibre && <> · <kbd>Échap</kbd> annuler</>}
        </p>
      </aside>
    </div>
  );
}
