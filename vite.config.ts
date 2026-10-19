import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { feuillesPolices, listePrecache, sourceServiceWorker } from './src/pwa/precache.ts';

/** Tous les fichiers d'un dossier, chemins relatifs à ce dossier. */
function fichiersDe(dossier: string): string[] {
  return readdirSync(dossier, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dossier, join(e.parentPath, e.name)).replaceAll('\\', '/'));
}

// Hors-ligne : une fois la construction écrite (public/ compris), publie le service worker
// en sw.js, avec la liste des fichiers à mettre en cache et une version, empreinte de leur contenu.
function horsLigne(): Plugin {
  let racine = '.';
  let sortie = 'dist';
  return {
    name: 'hors-ligne',
    apply: 'build',
    configResolved(config) {
      racine = config.root;
      sortie = resolve(racine, config.build.outDir);
    },
    closeBundle() {
      const fichiers = listePrecache(fichiersDe(sortie));
      const empreinte = createHash('sha256');
      for (const f of fichiers) {
        empreinte.update(f).update(readFileSync(join(sortie, f === './' ? 'index.html' : f)));
      }
      const gabarit = readFileSync(resolve(racine, 'src/pwa/sw.js'), 'utf8');
      const source = sourceServiceWorker(gabarit, {
        fichiers,
        polices: feuillesPolices(readFileSync(join(sortie, 'index.html'), 'utf8')),
        version: empreinte.digest('hex').slice(0, 12),
      });
      writeFileSync(join(sortie, 'sw.js'), source);
    },
  };
}

// L'application est servie par GitHub Pages sous /mini-cassiopee/.
export default defineConfig({
  base: '/mini-cassiopee/',
  plugins: [react(), horsLigne()],
});
