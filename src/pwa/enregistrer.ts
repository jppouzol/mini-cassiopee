// Enregistrement du service worker (src/pwa/sw.js), qui rend l'application utilisable hors ligne.

/**
 * Enregistre le service worker, seulement dans la construction de production de Vite.
 * Jamais en développement, ni dans la version de test construite avec esbuild, où
 * import.meta.env n'existe pas : le chaînage optionnel le prévoit.
 */
export function enregistrerServiceWorker(): void {
  if (!import.meta.env?.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Pas de mode hors ligne : l'application fonctionne quand même en ligne.
    });
  });
}
