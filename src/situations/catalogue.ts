import { parseSituation, type Situation } from './schema.ts';
import departGardeAvant from './catalogue/01-depart-garde-avant.json';
import departGardeArriere from './catalogue/02-depart-garde-arriere.json';
import amarreQuatreAmarres from './catalogue/03-amarre-quatre-amarres.json';
import amarresMolles from './catalogue/04-amarres-molles.json';

/** Situations du catalogue, dans l'ordre d'affichage. Ajouter ici tout nouveau fichier. */
export const CATALOGUE: readonly Situation[] = [
  departGardeAvant,
  departGardeArriere,
  amarreQuatreAmarres,
  amarresMolles,
].map(parseSituation);
