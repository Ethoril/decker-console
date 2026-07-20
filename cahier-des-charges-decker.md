# DECKER CONSOLE — Cahier des charges

Compagnon de jeu web pour les phases de hacking d'une campagne **Shadowrun Anarchy** (règles maison, voir §3). Deux rôles connectés en temps réel : **MJ** et **Decker** (un seul joueur hacker). L'appli visualise le réseau piraté, calcule les réserves de dés, gère jauges et dégâts, et remplace certaines résolutions par des mini-jeux dont la difficulté est paramétrée par un jet de dés initial.

---

## 1. Stack technique

| Élément | Choix | Justification |
| --- | --- | --- |
| Front | **Vite + React 18 + TypeScript** | SPA statique, stack déjà maîtrisée |
| Rendu carte | **SVG natif dans React** (pas de lib de graphe) | Contrôle total du style néon, pan/zoom simple |
| État local | **Zustand** | Léger, déjà utilisé sur d'autres projets |
| Styles | **Tailwind CSS v4** | Idem |
| Synchro temps réel | **Firebase Realtime Database** (plan Spark gratuit) | Latence faible, modèle simple clé/valeur, `onValue` natif |
| Auth | **Firebase Anonymous Auth** | Aucun compte à créer, le code de session fait office de secret |
| Hébergement | **GitHub Pages** | Build statique via GitHub Actions |

Pas de backend custom : toute la logique tourne côté client, la RTDB n'est qu'un bus d'état partagé.

**Choix RTDB vs Firestore** : RTDB retenu pour la simplicité du modèle arborescent, la latence, et le quota gratuit largement suffisant (1 session = quelques Ko). Les writes sont granulaires (chemin précis) pour éviter les conflits entre MJ et joueur.

**Cibles d'affichage** : **tablette paysage pour les deux rôles** (cible principale). La vue Decker doit rester utilisable en **smartphone paysage** (hauteur ~360-400 px) : mêmes zones, panneaux latéraux repliables en tiroirs pour rendre la carte prioritaire. Le portrait smartphone n'est pas une cible (un bandeau "tournez l'écran" suffit).

---

## 2. Modèle de données Firebase

```
sessions/{sessionCode}/
  meta/
    name: string
    createdAt: timestamp
    gmConnected: boolean
    deckerConnected: boolean

  environment/
    noise: 0 | 2 | 3 | 4            // malus bruit (faible/moyen/important)
    wifiDistance: 0 | 2 | 4          // malus distance (courte/moyenne/longue)

  network/
    nodes/{nodeId}/
      label: string
      type: 'entry' | 'firewall' | 'database' | 'device' | 'archive' | 'core'
      x: number, y: number           // coordonnées sur la carte
      security: 1..10                // niveau de sécurité (table §3.6)
      state: 'hidden' | 'spotted' | 'infiltrated' | 'alerted'
      marks: 0..4                    // marks du decker sur CE nœud
      paydata: string | null         // description du butin (visible MJ seul tant que non extrait)
      deviceInfo: string | null      // ce que contrôle le nœud (caméras, maglock…)
    links/{linkId}/
      from: nodeId, to: nodeId

  icons/{iconId}/
    kind: 'ice' | 'spider' | 'enemyHacker'
    nodeId: nodeId                   // position
    iceType: 'acide' | 'bloqueuse' | 'brouilleuse' | 'crash' | 'noire'
           | 'patrouilleuse' | 'potDeColle' | 'traceuse' | 'tueuse' | null
    revealed: boolean                // le decker a-t-il identifié le type ?
    visibleToPlayer: boolean         // l'icône apparaît-elle sur sa carte ?
    condition: number                // cases restantes (GLACE standard : à définir, ex. 6)
    label: string

  decker/
    nodeId: nodeId                   // position du persona
    mode: 'AR' | 'VR' | 'HOTSIM'
    stun: number                     // cases étourdissantes cochées
    physical: number                 // cases physiques cochées
    deckCondition: number            // 0..9 cases cochées (Cyber-5)
    firewallPenalty: number          // cumul GLACE Acide (scène)
    luck: number                     // points de Chance restants (init : 2)
    rerollUsedThisTest: boolean      // relance Cyber-5, 1/test
    programs/
      marteau: 'active' | 'crashed'
      discretion: 'active' | 'crashed'
    debuffs: string[]                // ex. ['bloqueuse'] → effets persistants
    surveillance: 0..6               // JAUGE DIEU — affichée en permanence au joueur (débutants)
    rebootCountdown: 0..3            // > 0 = deck inactif
    trapped: boolean                 // GLACE Pot de colle active → déconnexion interdite

  countdowns/
    intervention: number | null      // "équipe physique dans N tours" (palier 10)

  minigame/
    active: boolean
    type: string                     // cf. §6
    params: object                   // paramètres calculés à partir du jet
    progress: number                 // 0..100, pour le miroir MJ
    result: 'pending' | 'success' | 'failure'

  log/{pushId}/
    ts: timestamp
    kind: 'action' | 'roll' | 'damage' | 'alert' | 'gm' | 'system'
    text: string
    visibility: 'all' | 'gm'         // certaines entrées sont réservées au MJ
```

**Convention d'écriture** : chaque client n'écrit que sur les chemins de son rôle (le joueur ne touche jamais à `icons/`, le MJ peut tout modifier). Règles de sécurité RTDB minimales : lecture/écriture réservées aux connexions authentifiées anonymement ; le code de session (6 caractères aléatoires) sert de protection par obscurité — suffisant pour un outil de table entre amis.

---

## 3. Moteur de règles (Anarchy maison)

Le profil du personnage est **codé en dur** dans `src/data/persona.ts` (voir §3.1). Tout le reste du moteur est générique.

### 3.1 Persona (constantes)

```ts
export const PERSONA = {
  name: '…',                    // à compléter
  logique: 6,
  hacking: 5,
  specCybercombat: 2,           // spécialisation
  deck: {
    name: 'Shiawase Cyber-5',
    firewall: 2,
    monitor: 9,
    programSlots: 2,
    rerollPerTest: 1,           // 1 relance par test matriciel
  },
  datajack: 1,                  // +1D en RV (le bonus RV de la table inclut déjà ce cas ? NON : cumulatif, voir 3.2)
  traits: {
    bonCodeur: 2,               // +2D Hacking HORS cybercombat
    cybercombattant: 2,         // +2D cybercombat (redondant avec spé ? NON : cumulatif, total +4)
    ecorche: 2,                 // 2 cases Étourdissant à chaque connexion RV/Hot-Sim
  },
  programs: [
    { id: 'marteau', level: 2, effect: '+1 dégât en cybercombat' },
    { id: 'discretion', level: 2, effect: '-1D aux tests de pistage adverses' },
  ],
  chance: 2,
};
```

> Cumuls **validés par le MJ** : datajack +1D s'ajoute au +1D RV de la table des modes ; Cybercombattant +2D s'ajoute à la spécialisation +2 (soit +4 au total en cybercombat). Chaque ligne reste désactivable dans le panneau de composition du jet.

### 3.2 Composition des réserves de dés

Le moteur assemble la réserve **ligne par ligne**, chaque ligne affichée et désactivable (le joueur ou le MJ peut décocher une ligne contestée) :

**Test d'infiltration (hack de nœud)**
`Hacking 5 + Logique 6 + Bon codeur 2 [+1 RV] [+1 Hot-Sim… = mode] [+1 datajack si RV/HS] − bruit − distance ± modificateur sécurité du nœud (table §3.6) − debuffs`

**Cybercombat — attaque**
`Hacking 5 + Spé 2 + Logique 6 + Cybercombattant 2 [+ mode] [+ datajack] − malus`

**Cybercombat — défense**
`Logique 6 + Firewall (2 − pénalité Acide) + modificateurs`

**Perception matricielle (scan)**
`Logique 6 + Électronique 4 [+ mode/datajack]` — révèle les nœuds adjacents et/ou le type d'une GLACE.

### 3.3 Résolution des jets

- d6, **succès sur 5-6**.
- **Point de Chance** : avant de lancer, le joueur peut dépenser 1 point de Chance → succès sur **4-5-6** pour ce jet. Bouton toggle "🍀 Chance (4+)" sur l'écran de jet, décrémente `decker/luck`. Compteur rechargeable manuellement par le MJ (début de séance).
- **Relance Cyber-5** : après le résultat, bouton "Relancer les échecs" (1×/test) → relance les dés non-succès.
- **Dé de complication** : à chaque test de Hacking/Cybercombat du joueur, l'appli lance automatiquement 1 d6 de complication visible côté MJ. Sur un **1**, le MJ valide en un tap "+1 Surveillance" (il garde la main : c'est une proposition, pas un automatisme).
- Opposition : soit un seuil fixe (le MJ le saisit ou l'appli le propose selon la sécurité du nœud), soit un jet adverse (GLACE/Spider) lancé côté MJ. **Succès nets = succès − opposition.**

### 3.4 Marks et déplacement de nœud en nœud

Le decker progresse dans le graphe. Règles d'articulation (à ajuster en test) :

1. Le persona entre par un nœud `entry`.
2. **Scanner** (action) : révèle les nœuds adjacents au nœud courant (`hidden → spotted`).
3. **Hacker un nœud adjacent** (action) : choix d'approche **Force Brute** ou **Corruption**, puis jet. Les succès donnent les Marks selon la table : 2 → 1 Mark /GUEST, 3 → 2 /USER, 4 → 3 /POWER_USER, 5+ → 4 /ADMIN.
4. **Se déplacer** sur un nœud exige d'y détenir **≥ 1 Mark**.
5. Les **droits par niveau de Mark** conditionnent les actions disponibles sur le nœud (boutons grisés sinon) : 1 = tracer, 2 = lire les infos/paydata, 3 = modifier fichiers & fonctions (ouvrir un maglock, couper une caméra), 4 = contrôle total.
6. **Échec du hack** : Force Brute → dégâts au decker = succès excédentaires de la cible (Étourdissant en RA → deck ; Physique en RV) ; Corruption → le nœud passe en `alerted`, le decker est détecté (son icône devient visible des GLACES, le MJ déclenche la contre-mesure du niveau de sécurité).

### 3.5 Modes de connexion et dégâts

| Mode | Modif | Dégâts matriciels encaissés par | Autre |
| --- | --- | --- | --- |
| RA | Ø | le **deck** (étourdissant → 9 cases) | — |
| RV | +1D | le **decker** (physique) | Écorché : 2 cases Étourdi à la connexion |
| Hot-Sim | +1D, +1 action/narration | le **decker** (physique) | Écorché : idem |

Le changement de mode est une action du joueur ; l'appli applique Écorché automatiquement (avec confirmation) et route tous les dégâts entrants selon le mode courant. **Dumpshock** (éjection forcée) : bouton MJ → 3 cases (Étourdi en RA, Physique en RV).

Deck détruit (9/9) : bandeau "DECK HS — 1 Karma pour réparation" ; réparation en jeu = jet Électronique + Logique, chaque succès restaure 1 case (bouton dédié).

### 3.6 Niveaux de sécurité et contre-mesures

Table codée en dur (`src/data/security.ts`), le niveau du nœud pré-remplit modificateur et contre-mesure. Le MJ déclenche la contre-mesure en un tap quand les conditions narratives sont réunies :

| Niv. | Modif | Contre-mesure (bouton MJ) |
| --- | --- | --- |
| 1-2 | −2 / −1 | aucune |
| 3 | 0 | Alarme silencieuse : +2 au prochain jet du système (buff auto-appliqué) |
| 4 | +1 | Pic de données : jet **5D vs Firewall** résolu par l'appli, dégâts au deck/decker |
| 5 | +2 | Pic lourd : **8D vs Firewall** |
| 6 | +3 | Alarme audible + pic **10D vs FW** + +2 au prochain jet système |
| 7 | +4 | Spawn **1 GLACE** (attaque au tour suivant) |
| 8 | +5 | Spawn **3 GLACES** |
| 9 | +6 | Spawn **1 Spider** |
| 10 | +7 | Alarme + 3 GLACES + 1 Spider + **compte à rebours 10 tours** (équipe physique) |

### 3.7 GLACES

Stats standard : **Firewall 6, Logique 5**, dégâts de base 3 Étourdissant (3 **Physique** pour la Noire). Les 9 types et leurs effets sont codés (`src/data/ice.ts`) ; quand une attaque de GLACE touche, l'appli applique l'effet :

Acide (−1 Firewall decker, cumulatif, durée scène) · Bloqueuse (debuff : ignorer 1 succès sur les prochains tests) · Brouilleuse (reboot forcé fin de tour) · Crash (plante 1 programme au choix du MJ) · Noire (3P) · Patrouilleuse (relance 2 échecs en perception — géré côté jet MJ) · Pot de colle (`trapped: true`, fuite = test de Hacking) · Traceuse (+2D pistage) · Tueuse (+2D cybercombat).

Une GLACE non analysée apparaît chez le joueur comme un losange rouge anonyme ; un scan réussi révèle son type (`revealed: true`).

### 3.8 Cybercombat

Tour par tour informel (Anarchy) : le MJ résout les attaques des GLACES depuis sa vue (jets automatisés), le joueur les siennes. **Dégâts infligés = ⌈Logique/2⌉ + succès nets (+1 Marteau)**. Pour le persona : 6/2 = 3 + nets + 1. Les moniteurs se cochent automatiquement selon le routage du mode.

### 3.9 Surveillance et DIEU

- Jauge 0-6, stockée côté serveur, **affichée en permanence chez le MJ et chez le Decker** sous forme de barre de progression (pour faciliter le jeu avec des débutants).
- **Popup d'alerte Decker** : Dès que le niveau de surveillance augmente, un popup d'avertissement s'affiche sur l'écran du Decker pour lui indiquer son nouveau niveau.
- **Popup MJ de complication** : Si le Decker obtient un 1 sur son dé de complication, un modal apparaît immédiatement côté MJ pour lui proposer d'infliger +1 de Surveillance ou d'ignorer la complication (ce modal remplace l'affichage inline existant).
- **À 6 points** : séquence DIEU — plein écran rouge côté joueur détaillant explicitement les effets (dumpshock automatique de 3 cases étourdissantes, dégâts massifs au deck réglés par le MJ, position physique compromise signalée aux forces de sécurité locales, éjection immédiate et verrouillage de la console), et le MJ reprend la main narrativement.
- **Reboot** (action joueur) : Surveillance → 0, `rebootCountdown = 3`, console joueur grisée avec compte à rebours, purge aussi `trapped` et les buffs "alarme silencieuse" ? **Non** — seulement la Surveillance (les effets de scène persistent). Décrémentation du compteur : bouton "tour suivant" côté MJ.

---

## 4. Écrans

### 4.1 Communs
- **Accueil** : créer une session (génère le code) / rejoindre (code + rôle MJ ou Decker). Le rôle est mémorisé en localStorage… ❌ **non** — interdit en artefact mais OK ici car app auto-hébergée ; toutefois pour rester simple : rôle re-choisi à chaque connexion, pré-rempli via paramètre d'URL (`?session=XXXXXX&role=gm`), ce qui permet de garder un favori.
- **Thème** : fond quasi-noir, néons cyan/magenta/vert, police mono pour les logs, glow SVG (`filter: drop-shadow`). Sobre en animations permanentes (batterie mobile).

### 4.2 Vue Decker (tablette paysage, dégradable smartphone paysage)
Disposition en 3 zones horizontales :
1. **Carte réseau** (zone centrale, ~65 % de la largeur) : SVG pan/zoom (pointer events), fog of war, persona pulsant, diodes de Marks sur les nœuds, GLACES visibles selon `visibleToPlayer`.
2. **Colonne d'état** (gauche, étroite) : mode de connexion (sélecteur), moniteurs (deck 9 / étourdi / physique), programmes actifs, debuffs, Chance restante, cadran DIEU (visible).
3. **Colonne d'action contextuelle** (droite) : boutons selon le nœud courant et les Marks détenues — Scanner · Hacker (→ choix Force Brute/Corruption → écran de jet) · Se déplacer (action distincte) · Lire paydata · Contrôler périphérique · Attaquer (cybercombat) · Rebooter · Se déconnecter (bloqué si `trapped`).
4. **Log** en tiroir (bottom sheet), style terminal.

**Dégradation smartphone paysage** (breakpoint sur la hauteur, < ~500 px) : les deux colonnes se replient en tiroirs latéraux (icônes d'ouverture aux bords), la carte occupe tout l'écran, les moniteurs se résument à une barre compacte en haut (3 pastilles + cadran DIEU).

**Écran de jet** (modal) : composition de la réserve ligne à ligne (toggles), toggle Chance 🍀, bouton Lancer → animation des dés, succès surlignés, bouton Relance Cyber-5, publication du résultat.

### 4.3 Vue MJ (tablette paysage)
Trois colonnes :
1. **Carte complète** (éditable) : mode Édition (ajout/déplacement de nœuds, liens, propriétés, pose de GLACES et paydata ; import/export JSON du réseau) ↔ mode Jeu (déplacer les icônes, révéler/masquer, spawner via les contre-mesures).
2. **Panneau de contrôle** : jauge Surveillance (+/−), environnement (bruit, distance), dé de complication du dernier jet, boutons de contre-mesures du nœud sélectionné, compte à rebours d'intervention, bouton "tour suivant" (décrémente reboot/countdowns), fiches rapides GLACE/Spider sélectionnée avec bouton "Attaquer le decker" (jet auto 6+5 ou stats custom).
3. **Miroir joueur** : réplique compacte de l'état du decker (moniteurs, position, mini-jeu en cours avec sa progression) + log complet (y compris entrées `gm`).

Les hackers ennemis (`enemyHacker`) sont des icônes avec mini-fiche libre (réserve d'attaque/défense saisie par le MJ) — même moteur de jets.

---

## 5. Articulation jets ↔ mini-jeux

Principe : **le jet détermine la facilité du mini-jeu**. Flux :

1. Le joueur déclenche l'action → jet de dés → succès nets calculés.
2. L'appli propose : *Résolution directe* (le MJ tranche sur le jet seul, bouton MJ "passer le mini-jeu") ou *mini-jeu*, selon le réglage de l'action côté MJ.
3. Les succès nets alimentent les `params` du mini-jeu (table par jeu, §6). Un jet raté (0 net ou moins) peut soit être un échec direct, soit lancer le mini-jeu en difficulté maximale "dernière chance" — **réglage MJ par action**.
4. Le résultat du mini-jeu est publié : succès → effet plein (Marks, fuite réussie…) ; échec → conséquence de l'approche choisie (§3.4.6) ou effet de la GLACE.

Pendant le mini-jeu, la vue MJ affiche la progression en direct (`minigame/progress`).

---

## 6. Les mini-jeux (specs)

Tous : 30-60 s max, tactiles, un seul doigt, conçus pour le paysage (plein écran en modal) et lisibles jusqu'à une hauteur de ~360 px (smartphone paysage). Chacun est un composant isolé (`src/minigames/<nom>/`) avec la même interface `MiniGame({ params, onResult })` — l'ajout d'un jeu ne touche pas au reste.

### 6.1 Injection de code (Corruption) — type Mastermind
Deviner une séquence de N glyphes parmi un alphabet de M, en E essais. Retour après chaque essai : glyphe bien placé / présent ailleurs / absent.
Paramètres : nets ≥ 4 → N=3, M=5, E=6 · nets 2-3 → N=4, M=6, E=6 · nets 1 → N=4, M=6, E=5 · dernière chance → N=5, M=7, E=5.

### 6.2 Surcharge (Force Brute) — timing
Une aiguille oscille sur une barre ; stopper dans la zone verte R fois de suite. La zone rétrécit et la vitesse augmente à chaque palier.
Paramètres : nets élevés → zone large / vitesse lente / R=3 ; dégressif jusqu'à zone étroite / vitesse rapide / R=4. Chaque raté = 1 case de dégâts (routée selon le mode) ; 2 ratés consécutifs = échec.

### 6.3 Extraction d'urgence (fuite / Pot de colle) — labyrinthe
Tracer au doigt un chemin dans un labyrinthe de circuits avant expiration du timer, sans toucher les murs (tolérance paramétrable).
Paramètres : nets → taille de grille (8×8 → 14×14) et timer (25 s → 12 s).

### 6.4 Brouillage (anti-pistage / Traceuse) — défense
Des paquets de trace descendent vers le persona ; taper dessus pour les dissiper. Tenir T secondes en laissant passer moins de F paquets.
Paramètres : nets → fréquence de spawn et F (3 → 1). Succès = +N tours avant localisation (valeur affichée au MJ).

### 6.5 Décryptage (paydata) — pipe puzzle
Grille de segments de circuit à faire pivoter (tap) pour relier entrée et sortie avant le timer.
Paramètres : nets → taille (4×4 → 6×6) et timer (40 s → 20 s).

Chaque spec détaillée (états, rendu, edge cases) sera rédigée au moment de sa phase de dev.

---

## 7. Plan de développement

Découpage en briefs Claude Code successifs. Objectif : **jouable en table dès la fin de la Phase 3**.

**Phase 0 — Socle** ½ j
Init Vite/React/TS/Tailwind/Zustand, projet Firebase (RTDB + auth anonyme + règles), déploiement GitHub Pages via Actions, écran d'accueil créer/rejoindre, présence MJ/Decker.

**Phase 1 — Carte partagée** 1-2 j
Rendu SVG du graphe (pan/zoom tactile), éditeur MJ (nœuds, liens, propriétés, GLACES, import/export JSON), synchro RTDB, fog of war côté joueur, déplacement du persona, action Scanner.

**Phase 2 — Moteur de jets** 1-2 j
`persona.ts`, composeur de réserve ligne à ligne, modes de connexion (+ Écorché), Chance 4+, relance Cyber-5, dé de complication, seuils/oppositions, log temps réel. Action Hacker complète : approche, jet, Marks, droits par Mark, conséquences d'échec.

**Phase 3 — Menace** 1-2 j
Moniteurs de condition + routage des dégâts, jauge Surveillance (affichée/convergence DIEU à 6), Reboot, Dumpshock, contre-mesures par niveau de sécurité (pics de données automatisés, spawns), GLACES : types, effets, cybercombat complet, panneau MJ de pilotage, hackers ennemis. → **Version jouable.**

**Phase 4 — Mini-jeux** 1 j / jeu
Framework `MiniGame` + miroir MJ, puis les 5 jeux dans l'ordre : Injection de code, Surcharge, Décryptage, Extraction, Brouillage.

**Phase 5 — Polish**
Sons (bips terminal, alarme DIEU), animations (glitch à l'alerte, pulse des GLACES), thème, écrans de convergence, QoL éditeur (bibliothèque de réseaux pré-faits).

---

## 8. Décisions de règles validées (MJ)

1. **Cumuls de bonus** : cumulatifs (datajack +1D s'ajoute au +1D du mode RV ; trait Cybercombattant +2D s'ajoute à la spécialisation +2). Les lignes restent désactivables individuellement dans le composeur de jet.
2. **Condition des GLACES** : **6 cases** par défaut, éditable par GLACE dans l'éditeur.
3. **Dé de complication** : 1 d6 lancé automatiquement à chaque test de Hacking/Cybercombat du joueur, visible côté MJ uniquement ; sur un "1", proposition "+1 Surveillance" validée en un tap par le MJ.
4. **Reboot** : purge uniquement la Surveillance (→ 0). Les effets de scène (Acide, alarmes, debuffs) persistent.
5. **Déplacement** : action distincte, vers un nœud adjacent où le decker détient ≥ 1 Mark.
6. **Seuil de succès** : 5-6 ; la dépense d'un point de Chance (avant le jet) abaisse le seuil à 4-6 pour ce jet.
