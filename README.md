# Mini Cassiopée

Simulateur pédagogique de manœuvre de port : un voilier de 10 m amarré à un quai, vu de dessus, pour comprendre comment il translate et pivote sous l'effet du moteur, de la barre, du vent et des aussières.

Mini Cassiopée reproduit et enrichit un outil utilisé par une monitrice de voile : un bateau en tissu posé sur une table, avec des fils de laine en guise d'aussières. Le nom rend hommage à ce petit bout de tissu et au bateau du stage, *Cassiopée*.

## Principes

- **Le bout de tissu d'abord** : chaque situation se décrit aussi simplement que sur la table.
- **Des principes, pas un bateau réel** : la physique est qualitativement juste, sans prétention de précision.
- **Le point de pivot est l'information centrale.**
- **Mobile d'abord** : utilisable au port, sur un téléphone, sans autre matériel.

## Utiliser

L'application est en ligne sur <https://jppouzol.github.io/mini-cassiopee/>. Elle fonctionne dans un navigateur, sur PC, tablette et téléphone.

## Développer

Prérequis : Node.js 22.18 ou plus récent (sous Windows sans droits d'administrateur, l'archive zip de Node.js décompressée dans le dossier utilisateur suffit) et Git.

```sh
npm install
npm run dev        # application en local, rechargée à chaque modification
npm test           # scénarios de référence du moteur, de la session et des situations
npm run typecheck  # vérification des types
npm run build      # version de production dans dist/
```

Les réglages physiques sont accessibles en ajoutant `#reglages` à l'adresse de l'application.

### Organisation du code

```text
src/
  sim/          moteur de simulation : modèle, effets, intégration, pivot (aucune dépendance au navigateur)
  session/      journal d'actions, images clés, lecture et retour arrière
  situations/   format JSON des situations, validation, catalogue
  render/       dessin de la scène sur Canvas
  ui/           interface React
tests/          scénarios de référence, exécutés avec le lanceur de tests de Node.js
```

`sim` ne dépend de rien ; `session` dépend de `sim` ; `render` et `ui` passent par `session`.

### Ajouter une situation au catalogue

Créer un fichier JSON dans `src/situations/catalogue/` sur le modèle des fichiers existants, puis l'ajouter à la liste de `src/situations/catalogue.ts`. Les tests vérifient automatiquement que chaque situation est valide.

### Cycle de développement

Chaque évolution passe par une branche et une demande de fusion. Les tests et la construction tournent automatiquement sur chaque demande ; chaque fusion dans `main` déploie la nouvelle version sur GitHub Pages.

## Licence

Code sous licence [MIT](LICENSE).
