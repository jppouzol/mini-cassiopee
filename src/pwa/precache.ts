// Construction du service worker à partir de son gabarit (src/pwa/sw.js).
// Fonction pure, sans dépendance : appelée par le plugin horsLigne de vite.config.ts, testée seule.

/** Ce que la construction injecte dans le gabarit. */
export interface Precache {
  /** Chemins des fichiers construits, relatifs à la racine du site (« index.html », « assets/x.js »…). */
  fichiers: readonly string[];
  /** Adresses des feuilles de polices Google déclarées dans index.html. */
  polices: readonly string[];
  /** Empreinte du contenu des fichiers : elle change dès qu'un fichier change. */
  version: string;
}

/** Fichiers jamais mis en cache : le service worker lui-même, et les fichiers techniques de l'hébergement. */
const EXCLUS = new Set(['sw.js', '.nojekyll']);

/**
 * Liste des adresses à mettre en cache, relatives à la racine du site : la page sous « ./ »
 * (c'est l'adresse qu'on ouvre), puis les autres fichiers, triés pour que la liste ne dépende
 * pas de l'ordre de lecture du disque.
 */
export function listePrecache(fichiers: readonly string[]): string[] {
  const liste = fichiers
    .map((f) => f.replaceAll('\\', '/'))
    .filter((f) => !EXCLUS.has(f) && !f.endsWith('.map'))
    .map((f) => (f === 'index.html' ? './' : f));
  return [...new Set(liste)].sort();
}

/** Source du service worker : le gabarit dont les trois marqueurs sont remplacés. */
export function sourceServiceWorker(gabarit: string, precache: Precache): string {
  const remplacements: Record<string, string> = {
    __VERSION__: JSON.stringify(precache.version),
    __FICHIERS__: JSON.stringify(listePrecache(precache.fichiers)),
    __POLICES__: JSON.stringify([...precache.polices]),
  };
  for (const marqueur of Object.keys(remplacements)) {
    if (!gabarit.includes(marqueur)) throw new Error(`Gabarit du service worker : marqueur ${marqueur} absent`);
  }
  return gabarit.replace(/__(VERSION|FICHIERS|POLICES)__/g, (m) => remplacements[m]);
}

/** Adresses des feuilles de polices Google déclarées dans une page HTML. */
export function feuillesPolices(html: string): string[] {
  const adresses: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*\bhref="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/g)) {
    adresses.push(m[1].replaceAll('&amp;', '&'));
  }
  return adresses;
}
