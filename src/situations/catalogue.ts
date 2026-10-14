import { parseSituation, type Situation } from './schema.ts';
import departGardeAvant from './catalogue/01-depart-garde-avant.json';
import departGardeArriere from './catalogue/02-depart-garde-arriere.json';
import amarreQuatreAmarres from './catalogue/03-amarre-quatre-amarres.json';
import catwayVerification from './catalogue/06-catway-verification.json';
import catwaySortieArriere from './catalogue/07-catway-sortie-arriere.json';
import catwaySortieAvant from './catalogue/08-catway-sortie-avant.json';

/** Groupe du menu : une famille (type de quai), un intertitre et ses situations. */
export interface GroupeCatalogue {
  type: Situation['quai']['type'];
  titre: string;
  situations: readonly Situation[];
}

/**
 * Groupes du menu, dans l'ordre d'affichage. Ajouter ici tout nouveau fichier, dans le groupe
 * de sa famille. Le groupe ne regarde que la présentation : le format des situations l'ignore.
 */
export const GROUPES: readonly GroupeCatalogue[] = ([
  { type: 'long-side', titre: 'Amarrage', situations: [amarreQuatreAmarres] },
  { type: 'long-side', titre: 'Départs', situations: [departGardeAvant, departGardeArriere] },
  { type: 'perpendiculaire', titre: 'Amarrage', situations: [catwayVerification] },
  { type: 'perpendiculaire', titre: 'Sorties', situations: [catwaySortieAvant, catwaySortieArriere] },
] as const).map((g) => {
  const situations = g.situations.map(parseSituation);
  // Une situation rangée dans le groupe d'une autre famille n'apparaîtrait pas là où on l'attend.
  for (const sit of situations) {
    if (sit.quai.type !== g.type) throw new Error(`Catalogue : « ${sit.titre} » n'est pas du type ${g.type} (groupe ${g.titre})`);
  }
  return { type: g.type, titre: g.titre, situations };
});

/** Situations du catalogue, à plat, dans l'ordre d'affichage. */
export const CATALOGUE: readonly Situation[] = GROUPES.flatMap((g) => g.situations);
