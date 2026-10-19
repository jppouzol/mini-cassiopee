// Hors-ligne : construction du service worker à partir de son gabarit, puis son comportement,
// exécuté dans un faux environnement (caches et réseau simulés).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { feuillesPolices, listePrecache, sourceServiceWorker } from '../src/pwa/precache.ts';

const GABARIT = readFileSync(new URL('../src/pwa/sw.js', import.meta.url), 'utf8');
const BASE = 'https://exemple.test/mini-cassiopee/';
const POLICE = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap';
const FICHIER_POLICE = 'https://fonts.gstatic.com/s/atkinson/v1/a.woff2';

test('liste à mettre en cache : la page sous ./, sans sw.js, triée', () => {
  assert.deepEqual(
    listePrecache(['sw.js', 'index.html', 'assets/index-b.js', 'assets\\index-a.css', 'icon.svg', 'assets/x.js.map']),
    ['./', 'assets/index-a.css', 'assets/index-b.js', 'icon.svg'],
  );
});

test('feuilles de polices lues dans la page, sans les simples préconnexions', () => {
  const html = `<link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="${POLICE.replace('&', '&amp;')}" />`;
  assert.deepEqual(feuillesPolices(html), [POLICE]);
});

test('gabarit : les trois marqueurs remplacés, le service worker est du JavaScript valide', () => {
  const source = sourceServiceWorker(GABARIT, { fichiers: ['index.html', 'sw.js'], polices: [POLICE], version: 'abc' });
  assert.ok(!/__(VERSION|FICHIERS|POLICES)__/.test(source));
  assert.ok(source.includes('const VERSION = "abc";'));
  assert.ok(source.includes('const FICHIERS = ["./"];'));
  new Script(source);
  assert.throws(() => sourceServiceWorker('const VERSION = __VERSION__;', { fichiers: [], polices: [], version: 'x' }));
});

// --- Faux environnement de service worker -------------------------------------------------

interface Rep { url: string; corps: string; ok: boolean; type: string; clone(): Rep; text(): Promise<string> }
const reponse = (url: string, corps: string, ok = true): Rep => ({
  url, corps, ok, type: 'basic', clone: () => reponse(url, corps, ok), text: async () => corps,
});
const cle = (r: string | { url: string }) => (typeof r === 'string' ? r : r.url);

/** Charge le service worker construit dans un bac à sable ; le réseau est décrit par `reseau`. */
function environnement(fichiers: string[], version: string, reseau: Map<string, string>, caches = new Map<string, Map<string, Rep>>()) {
  const ecouteurs: Record<string, (e: unknown) => void> = {};
  const appels: string[] = [];
  const fetch = async (r: string | { url: string }) => {
    const url = cle(r);
    appels.push(url);
    if (!reseau.has(url)) throw new TypeError('Pas de réseau');
    return reponse(url, reseau.get(url)!);
  };
  const ouvrir = (nom: string) => {
    if (!caches.has(nom)) caches.set(nom, new Map());
    const c = caches.get(nom)!;
    return {
      match: async (r: string | { url: string }) => c.get(cle(r))?.clone(),
      put: async (r: string | { url: string }, rep: Rep) => void c.set(cle(r), rep),
      addAll: async (rs: { url: string }[]) => {
        const reps = await Promise.all(rs.map((r) => fetch(r)));
        reps.forEach((rep, i) => c.set(rs[i].url, rep));
      },
    };
  };
  const contexte = createContext({
    URL, Request: class { url: string; constructor(u: string) { this.url = u; } },
    fetch,
    self: {
      location: new URL('sw.js', BASE),
      addEventListener: (type: string, f: (e: unknown) => void) => { ecouteurs[type] = f; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async (nom: string) => ouvrir(nom),
      keys: async () => [...caches.keys()],
      delete: async (nom: string) => caches.delete(nom),
      match: async (r: string | { url: string }, o: { cacheName: string }) => caches.get(o.cacheName)?.get(cle(r))?.clone(),
    },
  });
  const source = sourceServiceWorker(GABARIT, { fichiers, polices: [POLICE], version });
  new Script(source).runInContext(contexte);
  const attendre = async (type: string) => {
    let promesse: Promise<unknown> = Promise.resolve();
    ecouteurs[type]({ waitUntil: (p: Promise<unknown>) => { promesse = p; } });
    await promesse;
  };
  /** Requête vue par le service worker : réponse servie, ou undefined s'il la laisse passer. */
  const requete = async (url: string, mode = 'no-cors') => {
    let servie: Promise<Rep> | undefined;
    ecouteurs.fetch({ request: { url, method: 'GET', mode }, respondWith: (p: Promise<Rep>) => { servie = p; } });
    return servie && (await servie);
  };
  return { caches, appels, attendre, requete };
}

const reseauV1 = () => new Map([
  [BASE, 'page v1'], [BASE + 'assets/app-1.js', 'js v1'], [BASE + 'icon.svg', 'icône'],
  [POLICE, `@font-face { src: url(${FICHIER_POLICE}) format('woff2'); }`], [FICHIER_POLICE, 'police'],
]);

test('première visite puis hors ligne : la page, ses fichiers et les polices viennent du cache', async () => {
  const reseau = reseauV1();
  const sw = environnement(['index.html', 'assets/app-1.js', 'icon.svg'], 'v1', reseau);
  await sw.attendre('install');
  await sw.attendre('activate');
  reseau.clear();
  assert.equal((await sw.requete(BASE, 'navigate'))?.corps, 'page v1');
  assert.equal((await sw.requete(BASE + 'autre/chemin', 'navigate'))?.corps, 'page v1');
  assert.equal((await sw.requete(BASE + 'assets/app-1.js'))?.corps, 'js v1');
  assert.equal((await sw.requete(POLICE))?.corps.includes('@font-face'), true);
  assert.equal((await sw.requete(FICHIER_POLICE, 'cors'))?.corps, 'police');
  // Hors du site : le service worker laisse passer.
  assert.equal(await sw.requete('https://exemple.test/autre-site/'), undefined);
});

test('en ligne, l\'ouverture vient quand même du cache, sans attendre le réseau', async () => {
  const reseau = reseauV1();
  const sw = environnement(['index.html', 'assets/app-1.js', 'icon.svg'], 'v1', reseau);
  await sw.attendre('install');
  await sw.attendre('activate');
  reseau.set(BASE, 'page v2');
  sw.appels.length = 0;
  assert.equal((await sw.requete(BASE, 'navigate'))?.corps, 'page v1');
  assert.deepEqual(sw.appels, []);
});

test('nouvelle version : servie à l\'ouverture suivante, anciens caches supprimés, polices gardées', async () => {
  const reseau = reseauV1();
  const v1 = environnement(['index.html', 'assets/app-1.js', 'icon.svg'], 'v1', reseau);
  await v1.attendre('install');
  await v1.attendre('activate');
  reseau.set(BASE, 'page v2');
  reseau.set(BASE + 'assets/app-2.js', 'js v2');
  const v2 = environnement(['index.html', 'assets/app-2.js', 'icon.svg'], 'v2', reseau, v1.caches);
  v2.appels.length = 0;
  await v2.attendre('install');
  await v2.attendre('activate');
  // Les polices déjà en cache ne sont pas retéléchargées.
  assert.ok(!v2.appels.includes(FICHIER_POLICE));
  assert.deepEqual([...v2.caches.keys()].sort(), ['mini-cassiopee-polices', 'mini-cassiopee-v2']);
  reseau.clear();
  assert.equal((await v2.requete(BASE, 'navigate'))?.corps, 'page v2');
  assert.equal((await v2.requete(BASE + 'assets/app-2.js'))?.corps, 'js v2');
});

test('téléchargement interrompu : l\'installation échoue et l\'ancienne version reste', async () => {
  const reseau = reseauV1();
  const v1 = environnement(['index.html', 'assets/app-1.js', 'icon.svg'], 'v1', reseau);
  await v1.attendre('install');
  await v1.attendre('activate');
  reseau.set(BASE, 'page v2'); // assets/app-2.js manque : le réseau coupe en cours de route
  const v2 = environnement(['index.html', 'assets/app-2.js', 'icon.svg'], 'v2', reseau, v1.caches);
  await assert.rejects(v2.attendre('install'));
  reseau.clear();
  assert.equal((await v1.requete(BASE, 'navigate'))?.corps, 'page v1');
  assert.equal((await v1.requete(BASE + 'assets/app-1.js'))?.corps, 'js v1');
});
