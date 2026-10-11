# Consignes pour Claude

- Langue : français pour le code commenté, les messages de commit, les demandes de fusion, l'interface et la documentation.
- Documentation de référence : `docs/specifications.md` et `docs/architecture.md` font foi. Toute modification du périmètre, du comportement ou de l'architecture met à jour ces documents dans la même demande de fusion (y compris le registre des décisions).
- Cycle : une branche et une demande de fusion par évolution, jamais de poussée directe sur `main`. Jp relit et fusionne ; la fusion déploie sur GitHub Pages.
- Principes à respecter : voir « Principes directeurs » dans les spécifications (le bout de tissu d'abord, physique qualitative, complexité optionnelle, mobile d'abord).
- Architecture : `src/sim` ne dépend de rien ; `session` dépend de `sim` ; `render` et `ui` passent par `session`. Pas de syntaxe TypeScript non effaçable (enums, propriétés de paramètres de constructeur) : les tests tournent avec la suppression de types de Node.js.
- Avant de proposer une demande de fusion : `npm test` doit passer, et les comportements physiques modifiés doivent être couverts par un scénario dans `tests/`.
