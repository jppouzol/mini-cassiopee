import { parseSituation, type Situation } from './schema.ts';
import departGardeAvant from './catalogue/01-depart-garde-avant.json' with { type: 'json' };
import departGardeArriere from './catalogue/02-depart-garde-arriere.json' with { type: 'json' };
import amarreQuatreAmarres from './catalogue/03-amarre-quatre-amarres.json' with { type: 'json' };
import catwayVerification from './catalogue/06-catway-verification.json' with { type: 'json' };
import catwaySortieArriere from './catalogue/07-catway-sortie-arriere.json' with { type: 'json' };
import catwaySortieAvant from './catalogue/08-catway-sortie-avant.json' with { type: 'json' };
import libreSansVent from './catalogue/09-libre-sans-vent.json' with { type: 'json' };

/** Groupe du menu : une famille (type de quai), un intertitre et ses situations. */
export interface GroupeCatalogue {
  type: Situation['quai']['type'];
  titre: string;
  situations: readonly Situation[];
}

/** Groupe tel qu'il est déclaré, avant validation de ses situations. */
export interface GroupeDeclare {
  type: Situation['quai']['type'];
  titre: string;
  situations: readonly unknown[];
}

/**
 * Valide les situations de chaque groupe et vérifie qu'elles sont de la famille du groupe :
 * rangée dans le groupe d'une autre famille, une situation n'apparaîtrait pas là où on l'attend.
 */
export function grouper(groupes: readonly GroupeDeclare[]): GroupeCatalogue[] {
  return groupes.map((g) => {
    const situations = g.situations.map(parseSituation);
    for (const sit of situations) {
      if (sit.quai.type !== g.type) throw new Error(`Catalogue : « ${sit.titre} » n'est pas du type ${g.type} (groupe ${g.titre})`);
    }
    return { type: g.type, titre: g.titre, situations };
  });
}

/**
 * Groupes du menu, dans l'ordre d'affichage. Ajouter ici tout nouveau fichier, dans le groupe
 * de sa famille. Le groupe ne regarde que la présentation : le format des situations l'ignore.
 * Les tests vérifient que tout fichier du dossier catalogue/ y figure.
 */
export const GROUPES: readonly GroupeCatalogue[] = grouper([
  { type: 'long-side', titre: 'Amarrage', situations: [amarreQuatreAmarres] },
  { type: 'long-side', titre: 'Départs', situations: [departGardeAvant, departGardeArriere] },
  { type: 'perpendiculaire', titre: 'Amarrage', situations: [catwayVerification] },
  { type: 'perpendiculaire', titre: 'Sorties', situations: [catwaySortieAvant, catwaySortieArriere] },
  { type: 'libre', titre: 'Manœuvres', situations: [libreSansVent] },
]);

/** Situations du catalogue, à plat, dans l'ordre d'affichage. */
export const CATALOGUE: readonly Situation[] = GROUPES.flatMap((g) => g.situations);
