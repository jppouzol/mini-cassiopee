# Consignes pour Claude

- Langue : français pour le code commenté, les messages de commit, les demandes de fusion, l'interface et la documentation.
- Documentation de référence : `docs/specifications.md` et `docs/architecture.md` font foi. Toute modification du périmètre, du comportement ou de l'architecture met à jour ces documents dans la même demande de fusion (y compris le registre des décisions).
- Cycle : une branche et une demande de fusion par évolution, jamais de poussée directe sur `main`. Jp relit et fusionne ; la fusion déploie sur GitHub Pages.
- Demande de fusion : l'ouvrir en brouillon, la mise à jour de `docs/` en premier commit. Sa description commence par `Closes #N` pour fermer l'issue à la fusion : GitHub ne reconnaît que les mots-clés anglais (`Closes`, `Fixes`, `Resolves`), « Ferme #N » ne ferme rien. Elle reste en brouillon pendant que Jp essaie la version de test ; Claude la passe prête à relire quand Jp a fini de valider ses essais (ou Jp la passe lui-même). Une PR qui ne touche pas l'application (documentation, consignes, CI) n'a rien à essayer : elle s'ouvre directement prête.
- Principes à respecter : voir « Principes directeurs » dans les spécifications (le bout de tissu d'abord, physique qualitative, complexité optionnelle, mobile d'abord).
- Architecture : `src/sim` ne dépend de rien ; `session` dépend de `sim` ; `render` et `ui` passent par `session`. Pas de syntaxe TypeScript non effaçable (enums, propriétés de paramètres de constructeur) : les tests tournent avec la suppression de types de Node.js.
- Avant de proposer une demande de fusion : `npm test` doit passer, et les comportements physiques modifiés doivent être couverts par un scénario dans `tests/`.
- Tests et catalogue : les tests chargent leurs scénarios de référence dans `tests/situations/`, jamais dans le catalogue, qui évolue librement. Le catalogue n'est testé que sur ses règles (validité, bittes, aussières vers l'extérieur, gardes croisées). Un nouveau comportement se couvre par un scénario de référence, pas par une situation du catalogue.

## Environnement de développement de Claude (claude.ai)

Consignes pour les sessions lancées depuis claude.ai, dont l'environnement distant a un accès réseau restreint.

- **Dépôt** : le rattacher avec un accès en écriture (`push`), sinon `gh api` ne voit ni les issues ni les PR. GraphQL n'est pas disponible : `gh issue view` et `gh pr view` échouent, passer par l'API REST (`gh api repos/jppouzol/mini-cassiopee/...`).
- **Clone superficiel** : juste après le clone, lancer `git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'`, pour que `git push -u` établisse le suivi des branches. Sans cela, une alerte signale à tort des commits non poussés.
- **Registre npm** : il est en général inaccessible. Le vérifier une fois (`npm view react version`) et, en cas d'échec, ne pas insister : ni `npm install`, ni `npm ci`, ni contournement du proxy. Les tests n'ont pas besoin des dépendances : `npm test` fonctionne toujours.
- **Outils déjà installés** quand le registre est inaccessible :
  - construction de l'application avec esbuild et React, dans `/opt/npm-tools/node_modules` :
    `NODE_PATH=/opt/npm-tools/node_modules /opt/npm-tools/node_modules/.bin/esbuild src/main.tsx --bundle --minify --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=<dossier>/app.js` (produit aussi `app.css`) ;
  - essai dans un navigateur avec Playwright pour Python et le Chromium de `/opt/pw-browsers/chromium-*/chrome-linux/chrome`, au format téléphone (390 px de large) puis PC ;
  - la vérification complète des types (`npm run typecheck`) reste à la CI, qui tourne sur chaque PR.
- **PR en brouillon** : l'ouvrir avec `-F draft=true`. L'API REST de GitHub ne permet pas de la passer prête, et GraphQL n'est pas disponible, mais le proxy de la session offre une route pour cela : `gh api -X POST repos/jppouzol/mini-cassiopee/pulls/<numéro>/ccr/ready_for_review` (vérifiée le 15 octobre 2026 sur la PR #47).
- **Avant d'ouvrir une PR** : `npm test`, construction avec esbuild, puis essai de la fonctionnalité dans Playwright sur l'application construite, pas sur une maquette.
- **Artefact de test** : à chaque PR qui touche l'application, sans attendre que Jp le demande, assembler une page HTML autonome (CSS et JS de la construction intégrés, polices Google en lien) et la publier comme artefact privé, en même temps que l'ouverture de la PR en brouillon. Le republier à chaque nouvelle version de la branche. Il est supprimé une fois la PR fusionnée.
