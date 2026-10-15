# Mini Cassiopée — Spécifications

Document de référence du projet. Toute évolution du périmètre doit y être reportée, dans la même demande de fusion que le code concerné.

## Vision et objectif

Mini Cassiopée est une application web qui permet à un élève de comprendre, seul et sur son téléphone, comment un voilier amarré translate et pivote sous l'effet du moteur, de la barre, du vent et des aussières.

Elle reproduit et enrichit un outil pédagogique utilisé par une monitrice de voile : un morceau de tissu en forme de bateau vu de dessus, avec des fils de laine fixés à la coque en guise d'aussières. Posé sur une table, on bloque les fils comme s'ils étaient tournés sur un quai, puis on simule la marche avant ou arrière, avec ou sans vent, pour observer le comportement du bateau.

Le nom « Mini Cassiopée » est définitif : il rend hommage au petit bout de tissu et au bateau du stage, *Cassiopée*, lors du stage effectué avec cette monitrice.

L'objectif est de garder la simplicité de cet outil tout en ajoutant ce que le tissu ne permet pas : rejouer une manœuvre, l'arrêter, revenir en arrière, voir la tension des aussières et le point de pivot.

## Principes directeurs

Ces principes arbitrent toutes les décisions de conception, en particulier lors des ajouts de fonctionnalités.

1. **Le bout de tissu d'abord.** Toute situation doit pouvoir se décrire aussi simplement que sur la table : un bateau, un quai, quelques aussières, un sens de moteur.
2. **Des principes, pas un bateau réel.** La physique est qualitativement correcte : le bateau part dans le bon sens, pivote autour du bon point, avec des ordres de grandeur plausibles. Aucune valeur réelle (kN, nœuds) n'est affichée ni garantie.
3. **Le point de pivot est l'information centrale.** C'est ce que l'outil doit rendre visible avant tout.
4. **La complexité est optionnelle.** Chaque enrichissement du modèle ou de la scène (pas d'hélice, bi-safran, bateaux voisins…) s'active dans des paramètres avancés ; désactivé, le comportement de base reste inchangé. Une nouvelle commande (choquer une aussière…) peut rester disponible en permanence si, tant qu'on ne s'en sert pas, elle ne change rien.
5. **Enrichissement progressif.** On livre un socle utilisable, puis on ajoute des fonctionnalités une à une, sans ordre imposé ni palier, et sans basculer dans une simulation fine.
6. **Mobile d'abord.** L'outil doit être utilisable au port ou à bord, sur un téléphone, sans autre matériel.

## Utilisateurs et cas d'usage

L'utilisateur principal est l'élève, en autonomie, qui teste des scénarios. Le moniteur peut s'en servir pour une démonstration, mais l'outil n'est pas conçu pour un cours magistral ou une projection en salle.

| Utilisateur | Contexte | Support |
| --- | --- | --- |
| Élève en autonomie | Révision avant une sortie, débrief le soir au port | Smartphone, tablette |
| Moniteur | Démonstration ponctuelle à un élève ou un petit groupe | Smartphone, tablette |
| Concepteur (Jp) | Usage personnel, mise au point des scénarios | PC, tablette |

Deux familles de scénarios sont couvertes :

- **Manœuvre** : l'élève prépare une situation, lance la simulation, agit sur le moteur, la barre et les amarres, et observe la réaction du bateau (exemple : départ sur garde).
- **Vérification d'amarrage** : l'élève ne touche à aucune commande et laisse agir le vent seul, pour voir si l'amarrage tient et quelles aussières travaillent.

## Scène simulée

La scène se compose d'un seul bateau, d'un quai, d'aussières et du vent. Chaque élément a un réglage de base et des options avancées.

### Bateau

- Un modèle unique et générique, aux proportions d'un voilier de croisière de 10 m.
- Taquets : quatre, quelle que soit la situation, deux à l'étrave et deux à l'arrière, un sur chaque bord ; option pour en ajouter au maître-bau. L'éditeur propose ces quatre taquets tant que le maître-bau n'est pas livré. Ils permettent par exemple deux pointes arrière cul à quai, ou deux pointes avant étrave au quai, indispensables à la sortie en marche arrière.
- Paramètres avancés : pas d'hélice activable, avec choix du sens de rotation ; choix entre mono-safran et bi-safran.
- Le type de quille n'est pas paramétrable.

### Quai et environnement

- Amarrage le long du quai (long side) ou perpendiculaire au quai, le long d'un catway. Le type d'amarrage est fixé par la situation du catalogue ; l'éditeur ne le change pas.
- Option : bateaux voisins de part et d'autre, pour tester les points de pivot et les risques de contact. Le long du quai, un voisin peut être amarré devant, un autre derrière, chacun réglé à part : aucun, serré ou large. Ils ont la même coque, le même cap et le même écart au quai que le bateau, et restent immobiles. En perpendiculaire, voir ci-dessous. Sans voisin, rien ne change.
- Points d'amarrage côté quai : une rangée de bittes fixes, espacées de 2 m, sur toute la longueur du quai, comme sur un vrai quai. Les aussières du catalogue comme celles ajoutées dans l'éditeur sont tournées sur ces bittes, ou sur celles du catway ; on ne crée pas de point d'amarrage ailleurs.

#### Amarrage perpendiculaire

- **Catway** : petit ponton perpendiculaire au quai, long des 2/3 du bateau. Sa longueur n'est pas réglable à ce stade.
- **Second catway** : côté large, à 8 m de bord à bord du premier, il encadre avec lui deux places côte à côte, comme dans un port. Il est dessiné vide, sauf voisin côté large ; s'il est touché, il arrête le bateau comme le premier.
- **Sens** : le bateau a l'étrave ou l'arrière au quai, et son flanc bâbord ou tribord le long du catway, selon la situation. Son autre bout dépasse du catway, côté chenal.
- **Bittes du catway** : deux sur l'axe de chaque catway, l'une au milieu, l'autre près du bout. Seules celles du catway du bateau reçoivent des aussières ; celles du second catway servent à la place voisine.
- **Bittes du quai** : une dans l'alignement de chaque bord de catway, puis tous les 2 m, entre les catways comme au-delà. On peut y tourner une aussière depuis le bout du bateau qui fait face au quai.
- **Contact** : le catway arrête le bateau comme le quai et peut lui servir d'appui ; le bout du bateau peut aussi venir toucher le quai.
- **Repères du port** : le catway est d'un côté du bateau, le large de l'autre ; le quai est à un bout, le chenal à l'autre.
- **Voisins** : deux places voisines, chacune occupée ou non, réglées à part. **Côté catway**, le voisin est amarré de l'autre flanc du catway du bateau, qui sépare les deux coques. **Côté large**, il occupe la seconde place entre les deux catways, contre le second catway : rien ne sépare les coques, à 0,6 m l'une de l'autre. Chaque voisin a la même coque que le bateau, le même écart à son catway, l'étrave au quai quel que soit le bout au quai du bateau (tête-bêche si le bateau a l'arrière au quai) et son bout côté quai aligné sur celui du bateau dans la situation d'origine. Il reste immobile et se comporte comme le long du quai : il arrête le bateau, peut lui servir d'appui, et le contact est signalé de même.

### Aussières

- Chaque aussière relie un taquet du bateau à une bitte du quai ou du catway. Un même taquet peut porter plusieurs aussières (par exemple une pointe et une garde), mais deux aussières ne peuvent pas relier le même taquet à la même bitte.
- Par défaut, sa longueur est fixée à la position de départ ; elle est soit tendue, soit molle. Une aussière molle a 0,5 m de mou ; les situations du catalogue peuvent préciser une autre valeur.
- Son nom est déduit de la géométrie au départ : traversier si elle fait moins de 20° avec la perpendiculaire au bateau, sinon pointe si elle part vers l'extérieur du bateau (bitte en avant du taquet d'étrave, ou en arrière du taquet arrière) et garde dans le cas inverse ; avant ou arrière selon le taquet (voir le glossaire). Deux aussières de même nom sont départagées par leur bord quand elles sont sur deux bords différents (« Pointe arrière bâbord » et « Pointe arrière tribord ») : le bord de leur taquet. Sinon, un numéro les départage. L'élève peut la renommer. En perpendiculaire, la même règle s'applique, le catway jouant le rôle du quai : une aussière d'un taquet d'étrave vers le quai, devant l'étrave, est une pointe avant.
- Une situation compte au plus 6 aussières par défaut. Ce plafond est réglable entre 6 et 12 dans les options avancées de l'éditeur, sans pouvoir descendre sous le nombre d'aussières en place ; une situation du catalogue peut déclarer un plafond plus élevé.
- Larguée, elle disparaît de la scène (considérée comme remontée à bord).
- Choquée, elle file : tant que l'élève la laisse filer, elle s'allonge aussi vite que le bateau s'éloigne de sa bitte et ne le retient plus ; une fois bloquée, elle garde sa nouvelle longueur et retient de nouveau. Une aussière molle qu'on choque ne change pas tant que le bateau ne tire pas dessus. Elle peut filer sans limite de longueur.
- Enrichissements envisagés : reprendre une aussière (la raccourcir) pendant la manœuvre ; freiner une aussière qu'on choque ; longueur finie des aussières.

### Vent

- Direction et force fixées pendant la préparation, constantes pendant la simulation.
- Force exprimée de façon qualitative, par exemple faible ou soutenu, avec un effet plus ou moins marqué sur le bateau.
- Direction exprimée par des repères du port. Le long du quai : du quai, du large, de l'avant ou de l'arrière du bateau, et leurs combinaisons. En perpendiculaire : du catway, du large, du quai ou du chenal, et leurs combinaisons.
- Enrichissement envisagé : appui du vent sur l'étrave provoquant un pivot (effet de fardage).

## Modèle de simulation

La simulation est en deux dimensions, vue de dessus, et vise un comportement qualitativement juste plutôt qu'une précision physique.

- **Forces prises en compte dans le socle** : poussée du moteur (avant ou arrière, intensité unique), effort de la barre sur le safran quand le bateau a de l'erre ou que le flux de l'hélice passe sur le safran, résistance de la quille et du safran au dérapage, force du vent, retenue des aussières tendues, contact avec le quai, avec le catway et, s'il y en a, avec les bateaux voisins.
- **Mouvements** : translation dans le plan et rotation autour d'un axe vertical. Le point de pivot résulte des aussières tendues et des points de contact ; en eau libre, de la quille et du safran, qui le placent sur la coque : dans la moitié avant en marche avant, dans la moitié arrière en marche arrière.
- **Giration** : barre à fond, le bateau libre tourne dans un cercle d'environ deux longueurs, comme un voilier de croisière à quille aileron, et fait demi-tour dans une allée de port réaliste, en moins de 20 m. La quille limite la dérive au vent dès que le bateau a de l'erre ; à l'arrêt, le vent le pousse comme avant.
- **Aussières** : longueur maximale fixe ; une aussière ne retient que lorsqu'elle est tendue, jamais en compression.
- **Contact avec le quai** : traitement simple qui empêche le bateau de traverser le quai et peut servir de point d'appui ; les défenses ne sont pas modélisées dans le socle. Le catway reçoit le même traitement, sur ses deux flancs et son bout.
- **Contact avec un voisin** : même traitement que le quai, coque contre coque. Le voisin, immobile, arrête le bateau et peut servir de point d'appui (l'étrave contre son tableau, par exemple).
- **Amortissement** : le bateau ralentit naturellement dans l'eau, pour éviter des oscillations ou des glissements irréalistes.
- **Effets avancés, désactivés par défaut** : pas d'hélice selon le sens de rotation, différence mono/bi-safran, pivot sous l'effet du vent sur l'étrave.
- **Reproductibilité** : à conditions de départ et actions identiques, la simulation produit le même résultat. C'est la condition du pas à pas et du retour arrière.

## Commandes et interactions

L'application a deux modes : la **préparation**, où l'on règle la situation, et la **simulation**, où l'on manœuvre et observe.

### Pendant la simulation

| Commande | Valeurs | Disponibilité |
| --- | --- | --- |
| Moteur | Avant, neutre, arrière (sans réglage de puissance) | Socle |
| Larguer une aussière | Individuellement, à tout moment | Socle |
| Barre | Angle de barre, côté bâbord ou tribord | Socle |
| Ne rien faire | Laisser agir le vent seul | Socle |
| Choquer une aussière | Laisser filer ou bloquer, individuellement, à tout moment, en lecture comme en pause | Livré |
| Reprendre une aussière | Raccourcir pendant la manœuvre | Envisagé |

**Choquer une aussière** : chaque aussière de la liste porte un bouton « Choquer » à bascule, à côté de « Larguer ». Un premier appui la laisse filer et le bouton reste enfoncé ; un second appui la bloque. Le bouton s'utilise en lecture comme en pause : en pause, la bascule prend effet à la reprise ou au pas à pas suivant. Elle est enregistrée avec la manœuvre, comme les autres commandes. En préparation, le même bouton indique qu'une aussière file dès la mise en mouvement. Larguer une aussière qui file la fait disparaître, comme toute aussière larguée. Dans la scène, une aussière qui file apparaît molle, puisqu'elle ne retient pas ; la liste l'indique par « File ».

### Contrôle du déroulement

- Lecture, pause.
- Avance pas à pas.
- Retour arrière (rewind) jusqu'à n'importe quel instant de la manœuvre en cours.
- Réinitialisation à la situation de départ.

Les commandes doivent être utilisables au doigt sur un écran de téléphone, d'une seule main si possible.

## Interface et visualisation

L'écran de simulation est une vue de dessus 2D, la plus épurée possible, dans l'esprit d'un schéma plutôt que d'un rendu réaliste.

Éléments affichés :

- le bateau, le quai et, selon la situation, le catway et les bateaux voisins ;
- les aussières, avec un code couleur tendue / molle ;
- la position de la commande moteur (avant, neutre, arrière) et l'angle de barre ;
- la direction et la force du vent ;
- quand le bateau pivote : le point de pivot marqué sur la coque et une flèche de rotation à une extrémité du bateau ;
- quand le bateau touche un voisin : le contour du voisin en rouge et un anneau rouge sur chaque point de contact, tant que le contact dure.

Le quai reste en haut de l'écran ; en perpendiculaire, le catway et le bateau descendent verticalement depuis le quai.

### Zoom

Le bateau paraît petit sur un téléphone : l'élève peut zoomer sur la scène pour regarder un taquet, une aussière ou un voisin de près.

- **Sur téléphone et tablette** : le pincement à deux doigts zoome et déplace la vue en même temps. Un doigt garde ses rôles (toucher un taquet ou une bitte, glisser le bateau en préparation) ; poser un second doigt annule le geste à un doigt en cours, sans sélection ni déplacement du bateau.
- **Sur PC** : la molette, ou le pincement du pavé tactile, zoome autour du pointeur.
- **Bornes** : du cadrage par défaut (×1) à ×4. La vue zoomée reste à l'intérieur du cadrage par défaut : on ne dézoome pas au-delà et on ne s'éloigne pas du bateau.
- **Suivi** : la vue reste accrochée au bateau, décalée de ce que l'élève a déplacé ; en manœuvre, le bateau ne sort pas de l'écran pour autant.
- **Rendu** : seules les distances grossissent. Traits, textes, bittes et cibles tactiles gardent leur taille à l'écran ; l'échelle se raccourcit (5 m, 2 m ou 1 m) pour tenir dans son coin.
- **Recadrer** : un bouton sur la scène, visible seulement quand le cadrage a changé, revient au cadrage par défaut. Changer de situation ou de famille recadre aussi ; « Situation d'origine » et « ⏮ » gardent le zoom choisi.
- Le zoom est un réglage d'affichage : il ne change rien à la simulation ni à la manœuvre enregistrée.

Rien d'autre n'est affiché par défaut. Toute aide visuelle supplémentaire (trajectoire, flèches de forces, position fantôme de départ) devra être optionnelle.

## Préparation des situations

L'élève part d'un catalogue de situations types, qu'il peut ajuster dans un petit éditeur avant de lancer la simulation.

### Catalogue

Chaque situation définit : la configuration du quai (le long ou perpendiculaire, étrave ou arrière au quai), la position du bateau, les aussières en place et celles qui sont tendues au démarrage, le vent, et les options avancées actives. Contenu proposé, à valider : chaque famille commence par l'amarrage complet, suivi des manœuvres de départ. Le catalogue ne propose pas de voisins : l'élève les ajoute dans les options avancées.

- le long du quai, amarrage complet : deux pointes et deux gardes, vent soutenu du quai, sans commande : vérification d'amarrage (à essayer aussi vent du large) ;
- départ sur garde avant : seule la garde avant est tournée ;
- départ sur garde arrière : seule la garde arrière est tournée ;
- sur catway, amarrage complet : arrière au quai, deux pointes et deux gardes, vent soutenu du catway, sans commande : vérification d'amarrage, l'avant qui dépasse du catway est le plus exposé ;
- sur catway, arrière au quai : sortie en marche avant, depuis les deux pointes et la garde arrière ;
- sur catway, étrave au quai : sortie en marche arrière, depuis les deux pointes et la garde avant.

Sur catway, le bout au quai porte deux pointes, une vers chaque bord, en plus des gardes tournées sur le catway. Les pointes empêchent le bateau de s'éloigner du quai. Dans les sorties, une seule garde reste : celle qui l'empêche d'aller taper dans le quai, partie du bout tourné vers le quai. Comme sur un vrai bateau, chaque aussière du catalogue part vers l'extérieur du bateau, du bord de son taquet : sa bitte est plus écartée de l'axe que le taquet, et les deux pointes s'ouvrent en V.

Le long du quai, les gardes du catalogue sont croisées, comme sur un vrai quai : la garde avant est tournée sur une bitte au niveau de la moitié arrière du bateau, à 4 m en arrière du milieu, et la garde arrière, symétriquement, à 4 m en avant. Longues, presque parallèles au quai, elles retiennent bien le bateau en long.

Le catalogue est présenté en deux familles, selon le type d'amarrage : **le long du quai** et **sur catway**. L'élève choisit d'abord la famille, par deux boutons, puis la situation dans un menu qui ne liste que celles de cette famille. Le titre d'une situation ne répète donc pas son type d'amarrage. Changer de famille ouvre sa première situation. Dans le menu, les situations sont rangées en groupes à intertitre, non sélectionnables : **Amarrage** puis **Départs** le long du quai, **Amarrage** puis **Sorties** sur catway. D'autres groupes pourront s'ajouter.

Les bittes des situations du catalogue sont placées sur les rangées de bittes fixes du quai et du catway, en vérifiant que les scénarios de référence restent démonstratifs.

### Éditeur

L'éditeur agit pendant la préparation, c'est-à-dire tant que la simulation est à son instant de départ. Revenir au départ (⏮) après une manœuvre permet de modifier à nouveau la situation ; la manœuvre enregistrée est alors effacée, comme pour un changement de vent.

- Déplacer le bateau le long du quai ou du catway.
- Ajouter, retirer ou déplacer une aussière entre un taquet du bateau et une bitte du quai ou du catway.
- Indiquer pour chaque aussière si elle est tendue au moment de la mise en mouvement, et si elle file dès ce moment.
- Régler la direction et la force du vent.
- Activer les options avancées, dont le plafond d'aussières et les bateaux voisins.

#### Déplacer le bateau

- **Geste** : l'élève fait glisser la coque au doigt le long du quai. Un toucher bref garde son rôle (choisir un taquet) ; dès que le doigt bouge, c'est un déplacement, et la sélection en cours est annulée. Deux boutons ◀ ▶ font le même réglage pas à pas, ainsi que Maj + flèches gauche et droite sur PC.
- **Pas et bornes** : la position change par pas de 0,5 m, à 4 m au plus de part et d'autre de la position de la situation d'origine. Le bateau reste ainsi entier à l'écran sans que la vue bouge. S'il y a des voisins, le bateau s'arrête à 0,5 m au moins de chacun.
- **Voisins** : ils restent en place, comme d'autres bouts de tissu sur la table ; seul l'écart change.
- **Aussières** : elles restent tournées sur leurs bittes, comme les fils punaisés quand on fait glisser le tissu. Leur longueur et leur nom déduit suivent la nouvelle géométrie, si bien qu'une garde peut devenir traversier ; le mou et un nom choisi par l'élève sont conservés.
- **Affichage** : aucune valeur chiffrée. Les bittes servent de repère et la liste des aussières montre les noms à jour.
- La rangée de bittes se répète tous les 2 m : seule compte la position du bateau par rapport aux bittes. Décalé de 1 m par rapport aux situations du catalogue, le bateau peut recevoir à la fois un traversier avant et un traversier arrière.
- **En perpendiculaire** : le bateau glisse le long du catway, vers le quai ou vers le chenal, avec les mêmes pas et bornes ; il s'arrête à 0,5 m du quai. Les boutons deviennent ▲ ▼, et Maj + flèches haut et bas sur PC. Les aussières tournées sur le quai gardent leur bitte, comme les autres.
- « Situation d'origine » remet le bateau à sa place ; « ⏮ » garde la position choisie.
- Le choix du bord au quai et l'écart au quai au départ ne sont pas proposés par l'éditeur à ce stade.

#### Ajouter et supprimer une aussière

- **Ajouter** : l'élève touche un taquet sur la coque, puis une bitte sur le quai ou le catway. L'aussière est créée tendue, avec un nom déduit de sa géométrie. Tant qu'un taquet est sélectionné, les bittes sont mises en évidence ; toucher ailleurs annule la sélection. La création est refusée, avec un message, si elle crée un doublon ou dépasse le plafond.
- **Régler** : dans la liste des aussières, l'élève bascule chaque aussière entre tendue et molle, et entre bloquée et choquée (elle file dès la mise en mouvement) ; il peut aussi la renommer.
- **Supprimer** : en préparation, le bouton « Larguer » de la liste devient « Supprimer ». Une aussière supprimée disparaît de la situation préparée.
- Pendant la simulation, on ne peut ni ajouter ni supprimer d'aussière : seuls le choquer et le largage restent possibles.

#### Bateaux voisins

- **Réglage le long du quai** : dans les options avancées, « Voisin devant » et « Voisin derrière » valent chacun aucun, serré ou large. L'écart se compte depuis la place d'origine du bateau ; aucune valeur chiffrée n'est affichée.
- **Réglage en perpendiculaire** : « Voisin côté catway » et « Voisin côté large » valent chacun aucun ou présent ; leur place découle des catways.
- **Place** : le long du quai, un voisin est refusé, avec un message, si le bateau, déplacé, est trop près de la place qu'il occuperait. En perpendiculaire, glisser le bateau le long du catway ne le rapproche pas des voisins : leur réglage ne limite pas le déplacement.
- Comme le reste de la situation, les voisins se règlent en préparation ; « Situation d'origine » les remet comme dans le catalogue.

#### Situation préparée et situation d'origine

- Les modifications de l'éditeur produisent une **situation préparée**, qui sert de point de départ : « ⏮ » y revient, sans perdre la préparation.
- Un bouton distinct restaure la **situation d'origine** du catalogue.
- Choisir une autre situation dans le catalogue abandonne la préparation en cours.

Aucune sauvegarde ni partage de situation n'est prévu à ce stade : la situation préparée n'est pas conservée d'une visite à l'autre. Le stockage local dans le navigateur est envisageable (par exemple pour retrouver la dernière situation).

## Exigences techniques et non fonctionnelles

| Thème | Exigence |
| --- | --- |
| Plateformes | Navigateur web sur PC, Android et iOS |
| Architecture | Fonctionnement entièrement dans le navigateur, sans serveur applicatif |
| Stockage | Aucun obligatoire ; stockage local du navigateur possible |
| Hors-ligne | Souhaitable, pour un usage au port avec une couverture réseau faible |
| Affichage | Adapté aux petits écrans tactiles, en portrait comme en paysage |
| Performance | Animation fluide sur un smartphone milieu de gamme |
| Langue | Interface en français uniquement |
| Stack | Voir le [document d'architecture](architecture.md) |
| Licence | Code sous licence MIT, diffusion et redistribution libres |
| Données personnelles | Aucune collecte, aucun compte utilisateur |

## Évolutions

Le socle est livré : amarrage le long du quai, aussières fixes, moteur avant, neutre et arrière, largage individuel, barre, vent faible ou soutenu, tension des aussières et point de pivot, pause, pas à pas et retour arrière, catalogue et éditeur. Depuis, l'élève peut aussi choquer une aussière, placer des bateaux voisins devant et derrière, manœuvrer un bateau amarré perpendiculaire au quai, le long d'un catway, avec ses voisins de part et d'autre, et zoomer sur la scène.

Le projet s'enrichit ensuite progressivement, une fonctionnalité à la fois, sans paliers ni jalons : l'ordre suit les envies et les retours des élèves. Le backlog est tenu dans les issues GitHub du dépôt ; chaque issue devient une branche et une demande de fusion, qui met à jour ce document si elle change le périmètre.

Enrichissements envisagés, chacun optionnel et sans effet sur le comportement de base :

- pas d'hélice et son sens de rotation ;
- mono ou bi-safran ;
- pivot du vent sur l'étrave (fardage) ;
- longueur de catway réglable ;
- taquet au maître-bau ;
- reprendre une aussière pendant la manœuvre ;
- freiner une aussière qu'on choque ;
- longueur finie des aussières ;
- aides visuelles en option (trajectoire, flèches de forces, position fantôme).

## Critères d'acceptation du socle

Le socle est réussi quand un élève reproduit sur son téléphone un départ sur garde complet, en deux phases, et que le bateau se comporte comme le bateau en tissu.

- [ ] Positionner le bateau le long d'un quai, au doigt ou pas à pas, les aussières restant sur leurs bittes.
- [ ] Placer les aussières et indiquer lesquelles sont tendues au moment de la mise en mouvement.
- [ ] Partir d'une situation du catalogue, y ajouter une aussière (taquet puis bitte) et en supprimer une avant de lancer la simulation ; le nom déduit est juste, bâbord comme tribord au quai.
- [ ] Piloter le moteur (avant, neutre, arrière) pendant la simulation.
- [ ] Agir sur la barre pendant la simulation.
- [ ] Larguer chaque aussière individuellement pendant la simulation.
- [ ] Voir la tension des aussières (tendue / molle) et le point de pivot.
- [ ] Mettre en pause, avancer pas à pas, revenir en arrière.
- [ ] Phase 1 du départ sur garde : en appui sur la garde, le moteur fait pivoter le bateau autour de l'extrémité retenue, l'autre extrémité s'écarte du quai.
- [ ] Phase 2 : moteur dans l'autre sens, garde larguée, le bateau se dégage du quai.
- [ ] Vérification d'amarrage : sans commande, avec du vent, l'amarrage tient et les aussières qui travaillent sont visibles.
- [ ] Fonctionnement sur PC, Android et iOS.

## Hors périmètre

Sont exclus du projet, sauf décision contraire reportée dans ce document :

- simulation physique fine ou valeurs chiffrées réalistes (forces, vitesses) ;
- usage en cours magistral ou en projection ;
- comptes utilisateurs, serveur, sauvegarde en ligne et partage de situations ;
- vent variable pendant une simulation (rafales, bascules) ;
- rendu 3D ou réaliste ;
- plusieurs modèles de bateaux ;
- interface dans une autre langue que le français.

Les points suivants n'ont pas été tranchés et figurent dans les points ouverts : courant, houle, marnage, manœuvres sans quai (mouillage, bouée).

## Glossaire

| Terme | Définition dans le projet |
| --- | --- |
| Aussière | Cordage reliant un taquet du bateau à une bitte du quai |
| Bitte | Point d'amarrage fixe sur le quai ou le catway ; dans l'appli, une rangée espacée de 2 m sur le quai, et deux bittes par catway |
| Chenal | Passage d'eau libre devant les places de port ; en perpendiculaire, le bout du bateau opposé au quai lui fait face |
| Pointe avant / arrière | Aussière partant de l'avant (ou de l'arrière) du bateau vers l'avant (ou l'arrière) sur le quai |
| Garde avant / arrière | Aussière partant de l'avant (ou de l'arrière) du bateau, frappée vers l'arrière (ou l'avant) sur le quai ; limite les mouvements longitudinaux |
| Traversier | Aussière perpendiculaire au bateau, qui le tient contre le quai ; dans l'appli, toute aussière à moins de 20° de la perpendiculaire au départ |
| Larguer | Détacher une aussière ; dans l'appli, elle disparaît de la scène |
| Choquer / reprendre | Donner du mou à une aussière / la raccourcir |
| Point de pivot | Point autour duquel le bateau tourne à un instant donné |
| Pas d'hélice | Poussée latérale de l'hélice, surtout en marche arrière, qui fait dériver l'arrière d'un côté |
| Fardage | Prise au vent de la coque et du gréement |
| Maître-bau | Partie la plus large du bateau |
| Long side | Amarrage le long du quai, flanc contre le quai |
| Catway | Petit ponton perpendiculaire au quai, le long duquel le bateau est amarré ; dans l'appli, long des 2/3 du bateau |

## Points ouverts

- [ ] Courant, houle et marnage : à exclure définitivement ou à garder comme enrichissements lointains ?
- [ ] Manœuvres sans quai (mouillage, bouée) : dans ou hors du projet ?
- [ ] Licence des contenus pédagogiques (situations, textes) : CC0 proposée.
- [ ] Contenu définitif du catalogue de situations, à valider avec la monitrice.
- [ ] Réglage de la barre : quelques positions fixes ou un angle continu ?
- [ ] Défenses : à représenter un jour, ou le contact simple avec le quai, le catway et les voisins suffit-il ?
- [ ] Aides visuelles optionnelles (trajectoire, flèches de forces, position fantôme) : lesquelles retenir ?
