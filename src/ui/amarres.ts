// Commande des amarres simplifiée ou étendue (#75) : règles d'affichage, sans React,
// testables seules. Par défaut, chaque aussière n'a que « Larguer » (« Supprimer » en
// préparation) ; un interrupteur propre aux amarres affiche sous chacune une rangée de
// crans qui dit ce que fait l'équipier qui tient le bout. Ce n'est qu'une condition
// d'affichage : la simulation ne change pas.
import type { LineMode, MooringLine } from '../sim/types.ts';

/**
 * Cran de la commande d'une aussière. Bloquer est le cran par défaut : l'aussière est
 * tournée au taquet. Freiner (#23) viendra s'y ajouter.
 */
export type Cran = 'choquer' | 'bloquer' | 'reprendre';

/**
 * Crans dans l'ordre de l'échelle, de « je laisse partir » à « je tire » : celui de
 * l'affichage, du clavier et des lecteurs d'écran. Freiner s'insérera entre Choquer et
 * Bloquer.
 */
export const CRANS: readonly Cran[] = ['choquer', 'bloquer', 'reprendre'];

/** Mode de l'aussière dans la simulation pour chaque cran. */
export const MODE_DU_CRAN: Readonly<Record<Cran, LineMode>> = { choquer: 'choque', bloquer: 'bloque', reprendre: 'reprend' };

/** Libellé du cran (verbe), sur le bouton. */
export const LIBELLE_CRAN: Readonly<Record<Cran, string>> = { choquer: 'Choquer', bloquer: 'Bloquer', reprendre: 'Reprendre' };

/** Clé du stockage local qui garde le choix de l'élève, à part de celui du moteur. */
export const CLE_AMARRES_ETENDUES = 'mini-cassiopee.amarres-etendues';

/** Cran actuel d'une aussière. */
export function cranDe(l: Pick<MooringLine, 'mode'>): Cran {
  return l.mode === 'choque' ? 'choquer' : l.mode === 'reprend' ? 'reprendre' : 'bloquer';
}

/**
 * Cran voisin au clavier : `sens` -1 vers Choquer (Maj + chiffre), 1 vers Reprendre
 * (Alt + chiffre). Borné aux extrémités.
 */
export function cranVoisin(cran: Cran, sens: 1 | -1): Cran {
  const i = CRANS.indexOf(cran);
  return CRANS[Math.max(0, Math.min(CRANS.length - 1, i + sens))];
}

/**
 * Vrai quand l'état d'une aussière ne se lit que sur la commande étendue : une aussière
 * non larguée qui n'est pas sur Bloquer (après un retour arrière, ou réglée ainsi en
 * préparation). L'affichage étendu est alors imposé, et l'interrupteur ne peut pas le masquer.
 */
export function amarresForcees(lignes: readonly Pick<MooringLine, 'attached' | 'mode'>[]): boolean {
  return lignes.some((l) => l.attached && cranDe(l) !== 'bloquer');
}

/** Choix mémorisé de l'élève ; faute de stockage local, les amarres sont simplifiées. */
export function lireAmarresEtendues(): boolean {
  try {
    return globalThis.localStorage?.getItem(CLE_AMARRES_ETENDUES) === '1';
  } catch {
    return false;
  }
}

/** Garde le choix de l'élève ; un stockage indisponible est ignoré. */
export function ecrireAmarresEtendues(etendues: boolean): void {
  try {
    globalThis.localStorage?.setItem(CLE_AMARRES_ETENDUES, etendues ? '1' : '0');
  } catch {
    // Navigation privée ou stockage bloqué : le choix vaut pour cette visite seulement.
  }
}
