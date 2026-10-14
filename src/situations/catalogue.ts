import { parseSituation, type Situation } from './schema.ts';
import departGardeAvant from './catalogue/01-depart-garde-avant.json';
import departGardeArriere from './catalogue/02-depart-garde-arriere.json';
import amarreQuatreAmarres from './catalogue/03-amarre-quatre-amarres.json';
import departGardeAvantVoisins from './catalogue/05-depart-garde-avant-voisins.json';
import catwayVerification from './catalogue/06-catway-verification.json';
import catwaySortieArriere from './catalogue/07-catway-sortie-arriere.json';
import catwaySortieAvant from './catalogue/08-catway-sortie-avant.json';
import catwaySortieArriereVoisin from './catalogue/09-catway-sortie-arriere-voisin.json';

/** Situations du catalogue, dans l'ordre d'affichage. Ajouter ici tout nouveau fichier. */
export const CATALOGUE: readonly Situation[] = [
  departGardeAvant,
  departGardeArriere,
  amarreQuatreAmarres,
  departGardeAvantVoisins,
  catwayVerification,
  catwaySortieArriere,
  catwaySortieAvant,
  catwaySortieArriereVoisin,
].map(parseSituation);
