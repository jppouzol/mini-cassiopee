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
4. **La complexité est optionnelle.** Chaque enrichissement du modèle ou de la scène (pas d'hélice, fardage, bi-safran, bateaux voisins…) s'active dans des paramètres avancés ; désactivé, le comportement de base reste inchangé. Une nouvelle commande (choquer une aussière…) peut rester disponible en permanence si, tant qu'on ne s'en sert pas, elle ne change rien.
5. **Enrichissement progressif.** On livre un socle utilisable, puis on ajoute des fonctionnalités une à une, sans ordre imposé ni palier, et sans basculer dans une simulation fine.
6. **Mobile d'abord.** L'outil doit être utilisable au port ou à bord, sur un téléphone, sans autre matériel.

## Utilisateurs et cas d'usage

L'utilisateur principal est l'élève, en autonomie, qui teste des scénarios. Le moniteur peut s'en servir pour une démonstration, mais l'outil n'est pas conçu pour un cours magistral ou une projection en salle.

| Utilisateur | Contexte | Support |
| --- | --- | --- |
| Élève en autonomie | Révision avant une sortie, débrief le soir au port | Smartphone, tablette |
| Moniteur | Démonstration ponctuelle à un élève ou un petit groupe | Smartphone, tablette |
| Concepteur (Jp) | Usage personnel, mise au point des scénarios | PC, tablette |

Trois familles de scénarios sont couvertes :

- **Manœuvre** : l'élève prépare une situation, lance la simulation, agit sur le moteur, la barre et les amarres, et observe la réaction du bateau (exemple : départ sur garde).
- **Vérification d'amarrage** : l'élève ne touche à aucune commande et laisse agir le vent seul, pour voir si l'amarrage tient et quelles aussières travaillent.
- **Bateau libre** : sans quai ni amarre, en milieu de port, l'élève s'exerce au moteur et à la barre seuls : giration, demi-tour, marche arrière, dérive au vent.

## Scène simulée

La scène se compose d'un seul bateau, d'un quai, d'aussières et du vent ; en situation libre, du bateau et du vent seuls. Chaque élément a un réglage de base et des options avancées.

### Bateau

- Un modèle unique et générique, aux proportions d'un voilier de croisière de 10 m.
- Taquets : six, quelle que soit la situation, deux à l'étrave, deux au maître-bau et deux à l'arrière, un sur chaque bord. Ceux du maître-bau sont au milieu de la coque, au plus large ; tant qu'on n'y tourne aucune aussière, ils ne changent rien. Les taquets d'étrave et d'arrière permettent par exemple deux pointes arrière cul à quai, ou deux pointes avant étrave au quai, indispensables à la sortie en marche arrière. Une garde avant au maître-bau, moteur avant et barre au large, tient le bateau le long du quai le temps de passer les autres amarres ; barre au centre, l'arrière s'écarte, moins qu'avec une garde à l'étrave.
- Paramètres avancés : pas d'hélice, avec choix du sens de rotation ; choix entre mono-safran et bi-safran (envisagé).
- **Pas d'hélice** : un seul réglage, « Pas d'hélice » : aucun (par défaut), hélice à droite ou hélice à gauche. Quand le moteur tourne, l'hélice pousse l'arrière de côté. L'effet est net en marche arrière : hélice à droite, l'arrière part vers bâbord ; hélice à gauche, vers tribord. En marche avant, il est léger et de sens contraire. Il est le plus fort au démarrage, bateau arrêté, et faiblit quand le bateau prend de l'erre : lancé en marche arrière, barre à fond, on arrive à reculer droit. Rien n'est ajouté à la scène : on le voit à l'arrière qui part de côté. Aucune situation du catalogue ne l'active : l'élève l'ajoute sur n'importe laquelle. Au ralenti, il est plus discret, réduit comme la poussée ; pendant un coup de fouet, il est doublé. Comme les voisins, il se règle en préparation ; « Situation d'origine » ou le choix d'une autre situation le retire.
- Le type de quille n'est pas paramétrable.

### Quai et environnement

- Amarrage le long du quai (long side) ou perpendiculaire au quai, le long d'un catway ; ou bateau libre, sans quai. Le type d'amarrage est fixé par la situation du catalogue ; l'éditeur ne le change pas.
- Option : bateaux voisins de part et d'autre, pour tester les points de pivot et les risques de contact. Les départs et les sorties du catalogue en ont par défaut ; l'élève peut les retirer. Le long du quai, un voisin peut être amarré devant, un autre derrière, chacun réglé à part : aucun, serré ou large. Ils ont la même coque, le même cap et le même écart au quai que le bateau, et restent immobiles. En perpendiculaire, voir ci-dessous. Sans voisin, rien ne change.
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

#### Libre, en milieu de port

- **Scène** : de l'eau seule, sans quai, catway, bitte ni voisin : le bout de tissu posé sur la table sans aucun fil.
- **Départ** : le bateau est arrêté, étrave vers le haut de l'écran. Son cap ne se règle pas : sans repère autour de lui, il ne change rien.
- **Aussières** : aucune, et on ne peut pas en ajouter ; les taquets ne sont pas proposés.
- **Voisins** : aucun ; ils ne se règlent pas.
- **Contact** : rien à toucher, le bateau va où il veut.
- **Pas d'hélice et fardage** : ils se règlent comme ailleurs, dans les options avancées. C'est en libre que le fardage se voit le mieux : vent de face, l'avant abat.
- Le mouillage et la bouée ne sont pas traités : voir les points ouverts.

### Aussières

- Chaque aussière relie un taquet du bateau à une bitte du quai ou du catway. Un même taquet peut porter plusieurs aussières (par exemple une pointe et une garde), mais deux aussières ne peuvent pas relier le même taquet à la même bitte.
- Par défaut, sa longueur est fixée à la position de départ ; elle est soit tendue, soit molle. Une aussière molle a 0,5 m de mou ; les situations du catalogue peuvent préciser une autre valeur.
- Son nom est déduit de la géométrie au départ : traversier si elle fait moins de 20° avec la perpendiculaire au bateau, sinon pointe si elle part vers l'extérieur du bateau (bitte en avant du taquet d'étrave, ou en arrière du taquet arrière) et garde dans le cas inverse ; avant ou arrière selon le taquet (voir le glossaire). Deux aussières de même nom sont départagées par leur bord quand elles sont sur deux bords différents (« Pointe arrière bâbord » et « Pointe arrière tribord ») : le bord de leur taquet. Sinon, un numéro les départage. Une aussière partie du maître-bau est un traversier au maître-bau selon la même règle des 20° ; sinon, c'est une garde au maître-bau, nommée par ce qu'elle retient : garde avant si sa bitte est en arrière du taquet, puisqu'elle empêche le bateau d'avancer comme la garde avant (« Garde avant au maître-bau »), garde arrière dans le cas inverse. L'élève peut la renommer. En perpendiculaire, la même règle s'applique, le catway jouant le rôle du quai : une aussière d'un taquet d'étrave vers le quai, devant l'étrave, est une pointe avant.
- Une situation compte au plus 6 aussières par défaut. Ce plafond est réglable entre 6 et 12 dans les options avancées de l'éditeur, sans pouvoir descendre sous le nombre d'aussières en place ; une situation du catalogue peut déclarer un plafond plus élevé.
- Larguée, elle disparaît de la scène (considérée comme remontée à bord).
- Choquée, elle file : tant que l'élève la laisse filer, elle s'allonge aussi vite que le bateau s'éloigne de sa bitte et ne le retient plus ; une fois bloquée, elle garde sa nouvelle longueur et retient de nouveau. Une aussière molle qu'on choque ne change pas tant que le bateau ne tire pas dessus. Elle peut filer sans limite de longueur.
- Enrichissements envisagés : reprendre une aussière (la raccourcir) pendant la manœuvre ; freiner une aussière qu'on choque ; longueur finie des aussières.

### Vent

- Direction et force fixées pendant la préparation, constantes pendant la simulation.
- Force exprimée de façon qualitative, par exemple faible ou soutenu, avec un effet plus ou moins marqué sur le bateau. Le vent soutenu vaut environ les deux tiers de la poussée du moteur en marche avant et presque toute sa poussée arrière : on remonte au vent, lentement, et reculer contre lui est difficile.
- Direction exprimée par des repères du port. Le long du quai : du quai, du large, de l'avant ou de l'arrière du bateau, et leurs combinaisons. En perpendiculaire : du catway, du large, du quai ou du chenal, et leurs combinaisons. En situation libre, sans repère du port : de l'avant, de l'arrière, de bâbord ou de tribord du bateau au départ, et leurs combinaisons (de l'avant bâbord…). Le vent reste ensuite fixe : le bateau tourne dedans.
- **Fardage** : un réglage « Fardage », sans (par défaut) ou avec, dans les options avancées. Sans, le vent pousse le bateau en son milieu : il dérive sans tourner. Avec, la prise au vent de la coque et du gréement pèse plus au bout qui reçoit le vent : en avant vent de face, un peu en avant par le travers, en arrière vent arrière. Conséquences :
  - **Vent de face** : le bateau ne reste pas étrave au vent. L'avant abat d'un côté ou de l'autre, d'abord lentement puis de plus en plus vite : par vent soutenu, près de 10° en 10 s, presque en travers en 30 s. Il abat aussi en marche arrière barre au centre ; la barre ou le pas d'hélice peuvent décider du côté.
  - **Bateau arrêté** : il finit à peu près en travers, le vent un peu sur l'arrière du travers, quelle que soit la direction de départ ; vent arrière, il ne reste pas arrière au vent.
  - **Côté de l'abattée** : quand rien d'autre n'en décide (vent pile de face, barre au centre, sans pas d'hélice), il est tiré au hasard à chaque préparation : il change d'un essai à l'autre, mais le retour arrière et « ⏮ » rejouent la manœuvre à l'identique. Changer un réglage en préparation tire un nouveau côté.
  - **Amarré** : le bout du bateau qui reçoit le vent est un peu plus chargé ; l'amarrage du catalogue tient de même.
  - Rien n'est ajouté à la scène : on le voit au bateau qui tourne. Aucune situation du catalogue ne l'active : l'élève l'ajoute sur n'importe laquelle. Comme le pas d'hélice, il se règle en préparation ; « Situation d'origine » ou le choix d'une autre situation le retire.

## Modèle de simulation

La simulation est en deux dimensions, vue de dessus, et vise un comportement qualitativement juste plutôt qu'une précision physique.

- **Forces prises en compte dans le socle** : poussée du moteur (avant ou arrière, en marche ou au ralenti, à moitié de la marche, et doublée pendant un coup de fouet), effort de la barre sur le safran quand le bateau a de l'erre ou que le flux de l'hélice passe sur le safran, résistance de la quille et du safran au dérapage, force du vent, retenue des aussières tendues, contact avec le quai, avec le catway et, s'il y en a, avec les bateaux voisins.
- **Mouvements** : translation dans le plan et rotation autour d'un axe vertical. Le point de pivot résulte des aussières tendues et des points de contact ; en eau libre, de la quille et du safran, qui le placent sur la coque : dans la moitié avant en marche avant, dans la moitié arrière en marche arrière.
- **Vitesse** : moteur en avant, le bateau libre plafonne à environ 3 nœuds, et 2,5 en marche arrière, une allure de manœuvre de port ; au ralenti, environ 2 nœuds en avant et 1,7 en arrière. Le coup de fouet donne le coup de moteur plus franc qui redonne de la manœuvrabilité.
- **Giration** : barre à fond, le bateau libre tourne dans un cercle d'environ deux longueurs, comme un voilier de croisière à quille aileron, et fait demi-tour dans une allée de port réaliste, en moins de 20 m. La quille limite la dérive au vent dès que le bateau a de l'erre ; à l'arrêt, le vent le pousse comme avant.
- **Aussières** : longueur maximale fixe ; une aussière ne retient que lorsqu'elle est tendue, jamais en compression.
- **Contact avec le quai** : traitement simple qui empêche le bateau de traverser le quai et peut servir de point d'appui ; les défenses ne sont pas modélisées dans le socle. Le catway reçoit le même traitement, sur ses deux flancs et son bout. En situation libre, il n'y a pas de quai : aucun contact.
- **Contact avec un voisin** : même traitement que le quai, coque contre coque. Le voisin, immobile, arrête le bateau et peut servir de point d'appui (l'étrave contre son tableau, par exemple).
- **Amortissement** : le bateau ralentit naturellement dans l'eau, pour éviter des oscillations ou des glissements irréalistes.
- **Effets avancés, désactivés par défaut** : pas d'hélice selon le sens de rotation et fardage, le vent pesant plus au bout qui le reçoit (livrés) ; différence mono/bi-safran (envisagée).
- **Reproductibilité** : à conditions de départ et actions identiques, la simulation produit le même résultat. C'est la condition du pas à pas et du retour arrière.

## Commandes et interactions

L'application a deux modes : la **préparation**, où l'on règle la situation, et la **simulation**, où l'on manœuvre et observe.

### Pendant la simulation

| Commande | Valeurs | Disponibilité |
| --- | --- | --- |
| Moteur | Avant, neutre, arrière | Socle |
| Ralenti | Ralenti avant ou ralenti arrière : moitié de la poussée, entre le neutre et la marche | Livré |
| Coup de fouet | Coup avant ou coup arrière : poussée brève et forte, puis retour automatique du moteur | Livré |
| Larguer une aussière | Individuellement, à tout moment | Socle |
| Barre | Angle de barre, côté bâbord ou tribord | Socle |
| Ne rien faire | Laisser agir le vent seul | Socle |
| Choquer une aussière | Laisser filer ou bloquer, individuellement, à tout moment, en lecture comme en pause | Livré |
| Reprendre une aussière | Raccourcir pendant la manœuvre | Envisagé |

**Choquer une aussière** : chaque aussière de la liste porte un bouton « Choquer » à bascule, à côté de « Larguer ». Un premier appui la laisse filer et le bouton reste enfoncé ; un second appui la bloque. Le bouton s'utilise en lecture comme en pause : en pause, la bascule prend effet à la reprise ou au pas à pas suivant. Elle est enregistrée avec la manœuvre, comme les autres commandes. En préparation, le même bouton indique qu'une aussière file dès la mise en mouvement. Larguer une aussière qui file la fait disparaître, comme toute aussière larguée. Dans la scène, une aussière qui file apparaît molle, puisqu'elle ne retient pas ; la liste l'indique par « File ».

**Ralenti** : la commande moteur a cinq positions, sur trois colonnes : l'arrière à gauche, l'avant à droite, chacun avec le ralenti au-dessus de la marche, et le neutre au milieu, sur toute la hauteur, plus étroit. De haut en bas, on lit ralenti, marche, puis le coup de fouet en dessous : l'effort croît vers le bas. Chaque ralenti est dans la colonne de sa marche, ce qui suffit à les distinguer ; leur nom complet (« Ralenti arrière », « Ralenti avant ») est donné aux lecteurs d'écran et en info-bulle sur PC. Le ralenti réduit à la fois la poussée, le flux de l'hélice sur le safran et le pas d'hélice, de moitié environ : le bateau prend moins d'erre, la barre agit un peu moins sans erre, et le pas d'hélice est plus discret, comme au ralenti sur un vrai bateau. Il permet de graduer l'effort : ralenti, marche, coup de fouet.

- **Tenir sur une garde** : au ralenti, un départ sur garde se fait plus doucement, et une garde avant au maître-bau, barre au large, tient le bateau le long du quai comme en marche, la garde travaillant moitié moins.
- **Vent** : au ralenti, le vent soutenu pèse plus que le moteur par le travers ; face au vent, le bateau avance encore.
- **Toujours disponible** : tant qu'on ne s'en sert pas, le ralenti ne change rien, et la marche garde sa poussée. Aucun réglage, aucune situation du catalogue n'en dépend.
- **Affichage** : la flèche de poussée est plus courte et plus fine au ralenti.
- **Clavier** : ↑ et ↓ passent d'une position à la suivante, ralentis compris.

**Coup de fouet** : sous la commande moteur, deux boutons « Coup avant » et « Coup arrière » donnent une poussée brève et forte, le double de la poussée normale, avec un flux d'hélice plus fort sur le safran. En avant, le flux d'hélice renforcé sur le safran fait pivoter l'arrière plus vite qu'en marche avant simple, avant que le bateau ait pris beaucoup d'erre ; en arrière, il casse l'erre ou amorce un recul, et rend le pas d'hélice plus net. Le moteur revient ensuite de lui-même :

- **Depuis le neutre, ou dans le sens du moteur** : le coup dure 2 s, puis le moteur reprend sa position : neutre, ou ralenti ou marche dans le même sens. Depuis le ralenti, le coup garde sa poussée, le double de la marche.
- **À contre-sens** (coup arrière moteur en avant ou au ralenti avant, ou l'inverse) : le coup casse l'erre. Il s'arrête dès que le bateau ne va plus dans le sens de l'ancienne marche, au plus tard après 5 s, et le moteur revient au neutre. Si le bateau n'avait pas d'erre dans ce sens (retenu par une garde, par exemple), le coup dure 2 s.
- **Pendant un coup** : toucher une position du moteur (avant, ralenti, neutre ou arrière) l'arrête, et la nouvelle position s'applique tout de suite. Un nouveau coup remplace celui en cours et suit les mêmes règles, depuis la position où le moteur doit revenir : dans le même sens, les 2 s repartent ; à contre-sens de cette position, il casse l'erre et le moteur reviendra au neutre.
- **Réglage** : durée et intensité sont fixes ; l'élève ne les règle pas.
- **Affichage** : le bouton reste enfoncé pendant le coup, et la commande moteur montre la position où il reviendra.
- **Relecture** : le coup est enregistré avec la manœuvre ; demandé en pause, il part à la reprise ou au pas à pas suivant.
- **Clavier** : Page ↑ pour le coup avant, Page ↓ pour le coup arrière.

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
- la position de la commande moteur (avant, ralenti avant, neutre, ralenti arrière, arrière) et l'angle de barre ;
- la poussée du moteur, par une flèche à l'arrière du bateau, plus courte et plus fine au ralenti, plus longue et plus épaisse pendant un coup de fouet ;
- la direction et la force du vent ;
- quand le bateau pivote : le point de pivot marqué sur la coque et une flèche de rotation à une extrémité du bateau ;
- quand le bateau touche un voisin : le contour du voisin en rouge et un anneau rouge sur chaque point de contact, tant que le contact dure.

Le quai reste en haut de l'écran ; en perpendiculaire, le catway et le bateau descendent verticalement depuis le quai. En situation libre, le bateau part étrave vers le haut ; la vue reste fixe tant qu'il est dans le cadre, et se recale dès qu'il approche d'un bord, sans jamais le perdre. Le quadrillage de l'eau sert alors de repère pour voir le bateau avancer et tourner.

### Zoom

Le bateau paraît petit sur un téléphone, et le chenal y est vite hors de l'écran : l'élève peut zoomer sur la scène pour regarder un taquet, une aussière ou un voisin de près, ou dézoomer pour voir plus large.

- **Sur téléphone et tablette** : le pincement à deux doigts zoome et déplace la vue en même temps. Un doigt garde ses rôles (toucher un taquet ou une bitte, glisser le bateau en préparation) ; poser un second doigt annule le geste à un doigt en cours, sans sélection ni déplacement du bateau.
- **Sur PC** : la molette, ou le pincement du pavé tactile, zoome autour du pointeur. Un glisser à la souris déplace la vue, comme deux doigts sur téléphone ; en préparation, un glisser commencé sur le bateau le déplace toujours, et un clic garde son rôle.
- **Bornes** : de ×0,5 à ×4 autour du cadrage par défaut (×1). Dézoomer sert surtout sur téléphone, pour voir le chenal devant un catway pendant la manœuvre. Zoomée, la vue reste à l'intérieur du cadrage par défaut ; dézoomée, elle le contient : on ne s'éloigne jamais du bateau.
- **Suivi** : la vue reste accrochée au bateau, décalée de ce que l'élève a déplacé ; en manœuvre, le bateau ne sort pas de l'écran pour autant.
- **Rendu** : seules les distances changent. Traits, textes, bittes et cibles tactiles gardent leur taille à l'écran ; l'échelle change de longueur (10 m, 5 m, 2 m ou 1 m) pour garder sa taille dans son coin.
- **Recadrer** : un bouton sur la scène, visible seulement quand le cadrage a changé, revient au cadrage par défaut. Changer de situation ou de famille recadre aussi ; « Situation d'origine » et « ⏮ » gardent le zoom choisi.
- Le zoom est un réglage d'affichage : il ne change rien à la simulation ni à la manœuvre enregistrée.

Rien d'autre n'est affiché par défaut. Toute aide visuelle supplémentaire (trajectoire, flèches de forces, position fantôme de départ) devra être optionnelle.

## Préparation des situations

L'élève part d'un catalogue de situations types, qu'il peut ajuster dans un petit éditeur avant de lancer la simulation.

### Catalogue

Chaque situation définit : la configuration du quai (le long, perpendiculaire, étrave ou arrière au quai, ou aucun quai), la position du bateau, les aussières en place et celles qui sont tendues au démarrage, le vent, les bateaux voisins et les options avancées actives. Contenu proposé, à valider : chaque famille commence par l'amarrage complet, suivi des manœuvres de départ. Les départs et les sorties ont des voisins de part et d'autre, comme dans un vrai port où l'on part rarement d'un quai vide : ils montrent l'intérêt de la manœuvre, déborder sans toucher le bateau d'à côté. Les amarrages et la situation libre n'en ont pas. Dans les options avancées, l'élève retire ou remet chaque voisin, ou change son écart.

- le long du quai, amarrage complet : deux pointes et deux gardes, vent soutenu du quai, sans commande : vérification d'amarrage (à essayer aussi vent du large) ;
- départ sur garde avant : seule la garde avant est tournée, voisins serrés devant et derrière ;
- départ sur garde arrière : seule la garde arrière est tournée, voisins serrés devant et derrière ; l'étrave ne déborde le voisin de devant qu'après un appui assez long sur la garde ;
- sur catway, amarrage complet : arrière au quai, deux pointes et deux gardes, vent soutenu du catway, sans commande : vérification d'amarrage, l'avant qui dépasse du catway est le plus exposé ;
- sur catway, arrière au quai : sortie en marche avant, depuis les deux pointes et la garde arrière, voisins côté catway et côté large ;
- sur catway, étrave au quai : sortie en marche arrière, depuis les deux pointes et la garde avant, voisins côté catway et côté large ;
- libre, sans vent : bateau arrêté en milieu de port, sans amarre, pour la giration, le demi-tour et la marche arrière.

Sur catway, le bout au quai porte deux pointes, une vers chaque bord, en plus des gardes tournées sur le catway. Les pointes empêchent le bateau de s'éloigner du quai. Dans les sorties, une seule garde reste : celle qui l'empêche d'aller taper dans le quai, partie du bout tourné vers le quai. Comme sur un vrai bateau, chaque aussière du catalogue part vers l'extérieur du bateau, du bord de son taquet : sa bitte est plus écartée de l'axe que le taquet, et les deux pointes s'ouvrent en V.

Le long du quai, les gardes du catalogue sont croisées, comme sur un vrai quai : la garde avant est tournée sur une bitte au niveau de la moitié arrière du bateau, à 4 m en arrière du milieu, et la garde arrière, symétriquement, à 4 m en avant. Longues, presque parallèles au quai, elles retiennent bien le bateau en long.

Le catalogue est présenté en trois familles, selon le type d'amarrage : **le long du quai**, **sur catway** et **libre**. L'élève choisit d'abord la famille, par trois boutons, puis la situation dans un menu qui ne liste que celles de cette famille. Le titre d'une situation ne répète donc pas son type d'amarrage. Changer de famille ouvre sa première situation. Dans le menu, les situations sont rangées en groupes à intertitre, non sélectionnables : **Amarrage** puis **Départs** le long du quai, **Amarrage** puis **Sorties** sur catway, **Manœuvres** en libre. D'autres groupes pourront s'ajouter.

Les bittes des situations du catalogue sont placées sur les rangées de bittes fixes du quai et du catway, en vérifiant que les scénarios de référence restent démonstratifs.

### Éditeur

L'éditeur agit pendant la préparation, c'est-à-dire tant que la simulation est à son instant de départ. Revenir au départ (⏮) après une manœuvre permet de modifier à nouveau la situation ; la manœuvre enregistrée est alors effacée, comme pour un changement de vent.

- Déplacer le bateau le long du quai ou du catway.
- Choisir le bord du bateau au quai ou au catway : bâbord ou tribord.
- Ajouter, retirer ou déplacer une aussière entre un taquet du bateau et une bitte du quai ou du catway.
- Indiquer pour chaque aussière si elle est tendue au moment de la mise en mouvement, et si elle file dès ce moment.
- Régler la direction et la force du vent.
- Activer les options avancées : plafond d'aussières, bateaux voisins, pas d'hélice, fardage.

En situation libre, l'éditeur ne propose que le vent, le pas d'hélice et le fardage : sans quai ni aussière, la position, le bord, les amarres, le plafond d'aussières et les voisins n'ont pas de sens et sont masqués.

#### Déplacer le bateau

- **Geste** : l'élève fait glisser la coque au doigt le long du quai. Un toucher bref garde son rôle (choisir un taquet) ; dès que le doigt bouge, c'est un déplacement, et la sélection en cours est annulée. Deux boutons ◀ ▶ font le même réglage pas à pas, ainsi que Maj + flèches gauche et droite sur PC.
- **Pas et bornes** : la position change par pas de 0,5 m, à 4 m au plus de part et d'autre de la position de la situation d'origine. Le bateau reste ainsi entier à l'écran sans que la vue bouge. S'il y a des voisins, le bateau s'arrête à 0,5 m au moins de chacun.
- **Voisins** : ils restent en place, comme d'autres bouts de tissu sur la table ; seul l'écart change.
- **Aussières** : elles restent tournées sur leurs bittes, comme les fils punaisés quand on fait glisser le tissu. Leur longueur et leur nom déduit suivent la nouvelle géométrie, si bien qu'une garde peut devenir traversier ; le mou et un nom choisi par l'élève sont conservés.
- **Affichage** : aucune valeur chiffrée. Les bittes servent de repère et la liste des aussières montre les noms à jour.
- La rangée de bittes se répète tous les 2 m : seule compte la position du bateau par rapport aux bittes. Décalé de 1 m par rapport aux situations du catalogue, le bateau peut recevoir à la fois un traversier avant et un traversier arrière.
- **En perpendiculaire** : le bateau glisse le long du catway, vers le quai ou vers le chenal, avec les mêmes pas et bornes ; il s'arrête à 0,5 m du quai. Les boutons deviennent ▲ ▼, et Maj + flèches haut et bas sur PC. Les aussières tournées sur le quai gardent leur bitte, comme les autres.
- « Situation d'origine » remet le bateau à sa place ; « ⏮ » garde la position choisie.
- L'écart au quai au départ n'est pas proposé par l'éditeur à ce stade.

#### Choisir le bord au quai

- **Commande** : sous l'intitulé « Bord au quai » (« Bord au catway » en perpendiculaire), deux boutons « Bâbord » et « Tribord ». La situation du catalogue fixe le bord de départ.
- **Le bateau se retourne** : le long du quai, il pivote sur place autour de son centre, l'étrave passant de l'autre côté ; sur catway, il passe de l'autre côté de son catway, à la place symétrique, avec le même bout au quai.
- **Aussières en miroir** : chacune garde son rôle, son mou, son état (« file ») et le nom choisi par l'élève, et passe sur la bitte symétrique : la garde avant reste la garde avant, son taquet change de bord avec le flanc au quai.
- **Le long du quai, entre deux bittes** : si le bateau a été glissé d'un demi-mètre (ou de 1,5 m, 2,5 m…), le miroir de ses aussières tomberait entre deux bittes ; le bateau se décale alors de 1 m vers sa place d'origine en se retournant. Sans aussière, il ne bouge pas.
- **Vent fixe dans le port** : il garde sa direction à l'écran, si bien que son repère change. Le long du quai, « de l'avant » devient « de l'arrière », et inversement ; sur catway, « du catway » devient « du large », et inversement. « Du quai » et « du chenal » ne changent pas.
- **Voisins** : le long du quai, ils restent à leur place dans le port et se retournent sur eux-mêmes, pour garder le cap du bateau : le voisin devant passe derrière, avec le même réglage. Sur catway, leurs places sont définies par rapport au bateau : ils le suivent, côté catway comme côté large, et le second catway passe de l'autre côté avec lui.
- « Situation d'origine » remet le bord du catalogue ; « ⏮ » garde le bord choisi. Comme toute modification, changer de bord efface la manœuvre enregistrée.

#### Ajouter et supprimer une aussière

- **Ajouter** : l'élève touche un taquet sur la coque, puis une bitte sur le quai ou le catway. L'aussière est créée tendue, avec un nom déduit de sa géométrie. Tant qu'un taquet est sélectionné, les bittes sont mises en évidence ; toucher ailleurs annule la sélection. La création est refusée, avec un message, si elle crée un doublon ou dépasse le plafond.
- **Régler** : dans la liste des aussières, l'élève bascule chaque aussière entre tendue et molle, et entre bloquée et choquée (elle file dès la mise en mouvement) ; il peut aussi la renommer.
- **Supprimer** : en préparation, le bouton « Larguer » de la liste devient « Supprimer ». Une aussière supprimée disparaît de la situation préparée.
- Pendant la simulation, on ne peut ni ajouter ni supprimer d'aussière : seuls le choquer et le largage restent possibles.

#### Bateaux voisins

- **Réglage le long du quai** : dans les options avancées, « Voisin devant » et « Voisin derrière » valent chacun aucun, serré ou large. L'écart se compte depuis la place d'origine du bateau ; aucune valeur chiffrée n'est affichée.
- **Réglage en perpendiculaire** : « Voisin côté catway » et « Voisin côté large » valent chacun aucun ou présent ; leur place découle des catways.
- **Place** : le long du quai, un voisin est refusé, avec un message, si le bateau, déplacé, est trop près de la place qu'il occuperait. En perpendiculaire, glisser le bateau le long du catway ne le rapproche pas des voisins : leur réglage ne limite pas le déplacement.
- Comme le reste de la situation, les voisins se règlent en préparation ; « Situation d'origine » les remet comme dans le catalogue : présents dans les départs et les sorties, absents ailleurs.

#### Situation préparée et situation d'origine

- Les modifications de l'éditeur produisent une **situation préparée**, qui sert de point de départ : « ⏮ » y revient, sans perdre la préparation.
- Un bouton distinct restaure la **situation d'origine** du catalogue.
- Choisir une autre situation dans le catalogue abandonne la préparation en cours.

Aucune sauvegarde ni partage de situation n'est prévu à ce stade : la situation préparée n'est pas conservée d'une visite à l'autre. Le stockage local dans le navigateur est envisageable (par exemple pour retrouver la dernière situation).

#### Pendant la manœuvre

En manœuvre, l'élève a besoin du moteur, de la barre et des amarres, pas des réglages de départ, qu'il ne peut de toute façon plus changer : le panneau ne montre plus qu'eux, pour qu'ils soient le plus accessibles possible.

- **Masqué** : dès qu'on quitte la préparation (lecture, pause en cours de manœuvre, ou pas à pas depuis le départ), le titre de l'application, la section « Situation » (famille, situation, position, bord, vent) et les options avancées disparaissent, ainsi que les textes d'aide (« Barre à roue… », « revenez au départ… »).
- **Restent** : moteur, barre avec l'angle affiché, amarres avec leur état (sauf en situation libre, qui n'en a pas), puis l'affichage. Sur PC, le rappel des raccourcis clavier reste en bas du panneau.
- **Retour au départ** : « ⏮ » fait tout réapparaître, comme en préparation. Changer de situation passe donc par le retour au départ.
- Même comportement sur téléphone, tablette et PC.

## Installation et hors-ligne

Au port, le réseau est souvent faible ou absent : après une première visite, l'application s'ouvre et fonctionne entièrement sans réseau, comme le bout de tissu qu'on sort de sa poche.

- **Installation** : l'élève l'ajoute à l'écran d'accueil par le menu du navigateur (« Installer l'application » sur Android et sur PC, « Partager › Sur l'écran d'accueil » sur iOS). Elle s'ouvre alors en plein écran, sans barre d'adresse. L'application n'a pas de bouton d'installation à elle.
- **Icône** : la coque blanche vue de dessus, étrave vers le haut, sur fond bleu, tenue par deux aussières rouges à un quai. Nom sous l'icône : « Mini Cassiopée », même si certains téléphones le coupent.
- **Hors ligne** : installée ou non, une fois ouverte en ligne, elle fonctionne sans réseau, polices comprises. Tout se passe déjà dans le navigateur : rien d'autre n'est nécessaire.
- **Ouverture** : toujours immédiate, depuis l'appareil, même avec un réseau faible ; elle n'attend jamais le réseau.
- **Mise à jour** : quand une nouvelle version est publiée, elle se télécharge en arrière-plan à l'ouverture et s'applique à l'ouverture suivante, sans message. La séance en cours n'est jamais interrompue. Si le réseau coupe pendant le téléchargement, l'ancienne version reste et la mise à jour est retentée plus tard.
- **Données** : l'appareil ne garde que les fichiers de l'application ; aucune donnée sur l'élève.

## Exigences techniques et non fonctionnelles

| Thème | Exigence |
| --- | --- |
| Plateformes | Navigateur web sur PC, Android et iOS |
| Architecture | Fonctionnement entièrement dans le navigateur, sans serveur applicatif |
| Stockage | Aucun obligatoire ; stockage local du navigateur possible |
| Hors-ligne | Installable sur l'écran d'accueil et utilisable sans réseau après une première visite, pour un usage au port avec une couverture réseau faible |
| Affichage | Adapté aux petits écrans tactiles, en portrait comme en paysage |
| Performance | Animation fluide sur un smartphone milieu de gamme |
| Langue | Interface en français uniquement |
| Stack | Voir le [document d'architecture](architecture.md) |
| Licence | Code sous licence MIT, diffusion et redistribution libres |
| Données personnelles | Aucune collecte, aucun compte utilisateur |

## Évolutions

Le socle est livré : amarrage le long du quai, aussières fixes, moteur avant, neutre et arrière, largage individuel, barre, vent faible ou soutenu, tension des aussières et point de pivot, pause, pas à pas et retour arrière, catalogue et éditeur. Depuis, l'élève peut aussi choquer une aussière, placer des bateaux voisins devant et derrière, manœuvrer un bateau amarré perpendiculaire au quai, le long d'un catway, avec ses voisins de part et d'autre, et zoomer sur la scène. Il peut aussi activer le pas d'hélice, à droite ou à gauche, et le fardage, qui fait abattre l'avant vent de face, et choisir le bord du bateau au quai ou au catway. Il peut tourner une aussière sur un taquet au maître-bau, et donner un coup de fouet au moteur, en avant comme en arrière, ou passer le moteur au ralenti, pour une poussée plus douce et un pas d'hélice plus discret. En manœuvre, le panneau ne montre plus que les commandes : moteur, barre et amarres. Enfin, il peut manœuvrer un bateau libre, sans quai ni amarre, en milieu de port. Le moteur pousse à une allure de manœuvre de port, autour de 3 nœuds, et le vent pèse d'autant plus. Les départs et les sorties du catalogue placent des voisins de part et d'autre, que l'élève peut retirer. L'application s'installe sur l'écran d'accueil et fonctionne sans réseau après une première visite.

Le projet s'enrichit ensuite progressivement, une fonctionnalité à la fois, sans paliers ni jalons : l'ordre suit les envies et les retours des élèves. Le backlog est tenu dans les issues GitHub du dépôt ; chaque issue devient une branche et une demande de fusion, qui met à jour ce document si elle change le périmètre.

Enrichissements envisagés, chacun optionnel et sans effet sur le comportement de base :

- mono ou bi-safran ;
- longueur de catway réglable ;
- reprendre une aussière pendant la manœuvre ;
- freiner une aussière qu'on choque ;
- longueur finie des aussières ;
- coup de fouet dosé par l'élève, tant qu'il maintient le bouton ;
- vent fort, plus fort que le moteur en marche avant ;
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

Les points suivants n'ont pas été tranchés et figurent dans les points ouverts : courant, houle, marnage, mouillage et bouée.

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
| Coup de fouet | Poussée brève et forte du moteur, en avant ou en arrière ; dans l'appli, le double de la poussée normale, puis retour automatique du moteur |
| Ralenti | Régime le plus bas du moteur embrayé, en avant ou en arrière ; dans l'appli, la moitié de la poussée de la marche, pas d'hélice compris |
| Point de pivot | Point autour duquel le bateau tourne à un instant donné |
| Pas d'hélice | Poussée latérale de l'hélice, surtout en marche arrière, qui fait dériver l'arrière d'un côté |
| Hélice à droite / à gauche | Sens de rotation de l'hélice, vue de l'arrière en marche avant : à droite, dans le sens des aiguilles d'une montre. Hélice à droite, l'arrière part vers bâbord en marche arrière ; hélice à gauche, vers tribord |
| Fardage | Prise au vent de la coque et du gréement ; dans l'appli, option qui fait peser le vent plus au bout qui le reçoit : vent de face, l'avant abat |
| Maître-bau | Partie la plus large du bateau ; dans l'appli, un taquet de chaque bord, au milieu de la coque |
| Garde au maître-bau | Aussière partant du maître-bau : garde avant si elle est frappée vers l'arrière sur le quai, garde arrière vers l'avant |
| Long side | Amarrage le long du quai, flanc contre le quai |
| Catway | Petit ponton perpendiculaire au quai, le long duquel le bateau est amarré ; dans l'appli, long des 2/3 du bateau |
| Libre | Dans l'appli, situation sans quai ni amarre : le bateau seul en milieu de port |

## Points ouverts

- [ ] Courant, houle et marnage : à exclure définitivement ou à garder comme enrichissements lointains ?
- [ ] Mouillage et bouée : dans ou hors du projet ? Le bateau libre, sans quai ni amarre, est livré.
- [ ] Licence des contenus pédagogiques (situations, textes) : CC0 proposée.
- [ ] Contenu définitif du catalogue de situations, à valider avec la monitrice.
- [ ] Réglage de la barre : quelques positions fixes ou un angle continu ?
- [ ] Défenses : à représenter un jour, ou le contact simple avec le quai, le catway et les voisins suffit-il ?
- [ ] Aides visuelles optionnelles (trajectoire, flèches de forces, position fantôme) : lesquelles retenir ?
