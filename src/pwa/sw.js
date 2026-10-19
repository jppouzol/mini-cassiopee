// Service worker de Mini Cassiopée : l'application s'ouvre et fonctionne sans réseau après une
// première visite. Ce fichier est un gabarit : à la construction, le plugin horsLigne de
// vite.config.ts remplace les trois marqueurs ci-dessous et le publie en sw.js à la racine du site.

/** Empreinte de la construction : elle change à chaque nouvelle version. */
const VERSION = __VERSION__;
/** Fichiers de l'application, relatifs à la racine du site (la page est « ./ »). */
const FICHIERS = __FICHIERS__;
/** Feuilles de polices Google déclarées dans la page. */
const POLICES = __POLICES__;

const PREFIXE = 'mini-cassiopee-';
const CACHE = `${PREFIXE}${VERSION}`;
// Les polices ne changent pas d'une version à l'autre : leur cache est gardé.
const CACHE_POLICES = `${PREFIXE}polices`;
const HOTES_POLICES = ['fonts.googleapis.com', 'fonts.gstatic.com'];
/** Racine du site, terminée par « / » : c'est aussi l'adresse de la page. */
const BASE = new URL('./', self.location.href).href;

// Installation : tout télécharger, en contournant le cache HTTP pour ne jamais mélanger deux
// versions. Si un fichier manque, l'installation échoue et l'ancienne version reste en place.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(FICHIERS.map((f) => new Request(new URL(f, BASE).href, { cache: 'reload' })));
      // Les polices au mieux : sans elles, l'application garde ses polices de repli.
      await mettreEnCachePolices().catch(() => {});
      // La nouvelle version prend la main tout de suite ; la page ouverte, déjà chargée,
      // continue telle quelle et l'ouverture suivante sert la nouvelle version.
      await self.skipWaiting();
    })(),
  );
});

// Activation : supprimer les caches des versions précédentes.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(
        noms
          .filter((nom) => nom.startsWith(PREFIXE) && nom !== CACHE && nom !== CACHE_POLICES)
          .map((nom) => caches.delete(nom)),
      );
      await self.clients.claim();
    })(),
  );
});

// Requêtes : le cache d'abord, toujours. L'ouverture n'attend jamais le réseau.
self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);

  if (HOTES_POLICES.includes(url.hostname)) {
    event.respondWith(police(requete));
    return;
  }
  if (!url.href.startsWith(BASE)) return;

  // Toute navigation dans le site reçoit la page (le fragment, comme #reglages, n'est pas envoyé).
  const cle = requete.mode === 'navigate' ? BASE : requete;
  event.respondWith(caches.match(cle, { cacheName: CACHE }).then((enCache) => enCache || fetch(requete)));
});

/** Police ou feuille de polices : la copie en cache, sinon le réseau, puis mise en cache. */
async function police(requete) {
  const cache = await caches.open(CACHE_POLICES);
  // La réponse de Google varie selon le navigateur ; une copie faite par ce même navigateur convient.
  const enCache = await cache.match(requete.url, { ignoreVary: true });
  if (enCache) return enCache;
  const reponse = await fetch(requete);
  if (reponse.ok || reponse.type === 'opaque') await cache.put(requete.url, reponse.clone());
  return reponse;
}

/** Télécharge les feuilles de polices et les fichiers qu'elles citent, s'ils ne sont pas déjà en cache. */
async function mettreEnCachePolices() {
  const cache = await caches.open(CACHE_POLICES);
  for (const adresse of POLICES) {
    let feuille = await cache.match(adresse, { ignoreVary: true });
    if (!feuille) {
      const reponse = await fetch(adresse, { mode: 'cors' });
      if (!reponse.ok) continue;
      await cache.put(adresse, reponse.clone());
      feuille = reponse;
    }
    const texte = await feuille.text();
    for (const [, fichier] of texte.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)) {
      if (await cache.match(fichier, { ignoreVary: true })) continue;
      const reponse = await fetch(fichier, { mode: 'cors' });
      if (reponse.ok) await cache.put(fichier, reponse);
    }
  }
}
