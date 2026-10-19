// Commande moteur simplifiée ou étendue (#73) : règles d'affichage, sans React,
// testables seules. Par défaut, la commande n'a que trois boutons (arrière,
// neutre, avant) ; un interrupteur affiche la commande étendue (ralentis et
// coups de fouet). Ce n'est qu'une condition d'affichage : la simulation ne
// change pas.
import type { Engine, Kick } from '../sim/types.ts';
import { ENGINE_POSITIONS } from '../sim/kick.ts';

/** Positions de la commande simplifiée, de la marche arrière à la marche avant. */
export const POSITIONS_SIMPLES: readonly Engine[] = [-1, 0, 1];

/** Clé du stockage local qui garde le choix de l'élève d'une visite à l'autre. */
export const CLE_MOTEUR_ETENDU = 'mini-cassiopee.moteur-etendu';

/**
 * Vrai quand l'état du moteur ne se lit que sur la commande étendue : moteur au
 * ralenti ou coup de fouet en cours (après un retour arrière, par exemple).
 * L'affichage étendu est alors imposé, et l'interrupteur ne peut pas le masquer.
 */
export function etenduForce(s: { engine: Engine; kick: Kick | null }): boolean {
  return !POSITIONS_SIMPLES.includes(s.engine) || s.kick !== null;
}

/** Crans parcourus par ↑ et ↓ au clavier, selon la commande affichée. */
export function positionsClavier(etendu: boolean): readonly Engine[] {
  return etendu ? ENGINE_POSITIONS : POSITIONS_SIMPLES;
}

/**
 * Cran suivant au clavier (`sens` : 1 pour ↑, -1 pour ↓), borné aux extrémités.
 * Depuis une position absente des crans (un ralenti, en simplifié), on part de
 * la plus proche dans le sens demandé.
 */
export function cranSuivant(engine: Engine, sens: 1 | -1, etendu: boolean): Engine {
  const crans = positionsClavier(etendu);
  const i = crans.indexOf(engine);
  if (i >= 0) return crans[Math.max(0, Math.min(crans.length - 1, i + sens))];
  const suivants = crans.filter((p) => (sens > 0 ? p > engine : p < engine));
  if (suivants.length === 0) return engine;
  return sens > 0 ? suivants[0] : suivants[suivants.length - 1];
}

/** Choix mémorisé de l'élève ; faute de stockage local, la commande est simplifiée. */
export function lireMoteurEtendu(): boolean {
  try {
    return globalThis.localStorage?.getItem(CLE_MOTEUR_ETENDU) === '1';
  } catch {
    return false;
  }
}

/** Garde le choix de l'élève ; un stockage indisponible est ignoré. */
export function ecrireMoteurEtendu(etendu: boolean): void {
  try {
    globalThis.localStorage?.setItem(CLE_MOTEUR_ETENDU, etendu ? '1' : '0');
  } catch {
    // Navigation privée ou stockage bloqué : le choix vaut pour cette visite seulement.
  }
}
