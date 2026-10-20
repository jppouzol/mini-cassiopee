// Assemble la version de test d'une demande de fusion : une page HTML autonome tirée de la
// construction Vite (dist/), exactement ce que la CI publie, avec son JS et son CSS intégrés.
// Les polices Google restent en lien. Le manifeste et les icônes sont retirés : servis sous
// /mini-cassiopee/, ils n'existent pas là où la page est publiée. Le service worker ne s'y
// enregistre pas (l'échec est ignoré par l'application) : le hors-ligne s'essaie sur dist/.
// Usage : npm run build, puis node outils/artefact.mjs <page de sortie> [dossier dist]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [sortie, dist = 'dist'] = process.argv.slice(2);
if (!sortie) {
  console.error('Usage : node outils/artefact.mjs <page de sortie> [dossier dist]');
  process.exit(1);
}

// Les adresses de la page commencent par la base du site (/mini-cassiopee/).
const BASE = '/mini-cassiopee/';
const lire = (adresse) => readFileSync(join(dist, adresse.slice(BASE.length)), 'utf8');

let page = readFileSync(join(dist, 'index.html'), 'utf8');
let scripts = 0;
let feuilles = 0;

// Remplacements par fonction : un « $ » dans le JS ou le CSS ne doit pas être interprété.
page = page.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) => {
  scripts += 1;
  // Un « </script » dans le code fermerait la balise trop tôt.
  return `<script type="module">${lire(src).replaceAll('</script', '<\\/script')}</script>`;
});
page = page.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => {
  feuilles += 1;
  return `<style>${lire(href).replaceAll('</style', '<\\/style')}</style>`;
});
page = page
  .replace(/<!-- Installation sur l'écran d'accueil[^>]*-->\s*/, '')
  .replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*/g, '');

if (scripts !== 1 || feuilles !== 1) {
  throw new Error(`Page de dist/ inattendue : ${scripts} script(s) et ${feuilles} feuille(s) de style au lieu d'un de chaque.`);
}
// Seul le JS peut encore citer la base (enregistrement du service worker) : rien dans le HTML.
const html = page.replace(/<script type="module">[\s\S]*<\/script>/, '');
if (html.includes(BASE)) throw new Error(`Adresse sous ${BASE} restée dans la page.`);

writeFileSync(sortie, page);
console.log(`${sortie} : ${Math.round(page.length / 1024)} Ko`);
