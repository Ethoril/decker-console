# BRIEF CLAUDE CODE — Decker Console — Phase 0 + 1

## Contexte

Compagnon de jeu web pour les phases de hacking d'une campagne Shadowrun Anarchy. Deux rôles connectés en temps réel via Firebase Realtime Database : **MJ** (pilote le réseau, les GLACES) et **Decker** (un seul joueur, explore le réseau avec brouillard de guerre). Le cahier des charges complet existe par ailleurs ; ce brief couvre uniquement les **Phases 0 (socle) et 1 (carte partagée)**. Ne rien implémenter des phases suivantes (jets de dés, jauges, mini-jeux) — mais structurer le code pour les accueillir.

## Stack imposée

- **Vite + React 18 + TypeScript** (strict), **Tailwind CSS v4**, **Zustand**
- **Firebase JS SDK v10+ (modular)** : Realtime Database + Anonymous Auth
- **SVG natif React** pour la carte — AUCUNE lib de graphe, AUCUNE lib de pan/zoom
- Déploiement **GitHub Pages** via GitHub Actions
- Aucune autre dépendance sans justification

## Cibles d'affichage

Tablette **paysage** (cible principale, les deux rôles). La vue Decker doit se dégrader proprement en **smartphone paysage** (hauteur < ~500 px : panneaux latéraux repliés en tiroirs, carte plein écran). Portrait : simple overlay "Tournez l'écran". Interactions 100 % tactiles (pointer events).

## Thème

Fond quasi-noir (`#0a0e12`), néons cyan/magenta/vert, police mono pour les éléments "terminal", glow discret sur les éléments SVG (`drop-shadow`). Sobriété : pas d'animation permanente coûteuse (batterie).

---

# PHASE 0 — Socle

## 0.1 Init projet

- Vite React-TS, Tailwind v4, Zustand, ESLint. Dossier `src/` structuré :

```
src/
  firebase.ts          // init app, auth anonyme, export db
  types.ts             // types du modèle de données (voir §Modèle)
  store/
    session.ts         // store Zustand : code session, rôle, état de connexion
    network.ts         // store Zustand : miroir local de sessions/{code}
  sync/
    subscribe.ts       // onValue → hydratation des stores
    write.ts           // helpers d'écriture ciblée (update sur chemins précis)
  screens/
    Home.tsx           // créer / rejoindre
    GmView.tsx
    DeckerView.tsx
  components/
    map/               // tout le rendu SVG (Phase 1)
  data/                // (vide pour l'instant : accueillera persona.ts, security.ts…)
```

- `vite.config.ts` : `base: '/decker-console/'` (adapter au nom du repo).

## 0.2 Firebase

- `src/firebase.ts` : config via un objet `firebaseConfig` importé de `src/firebase.config.ts` (fichier créé avec des placeholders `VOTRE_API_KEY` etc. + commentaire expliquant où trouver les valeurs dans la console Firebase). Les clés Firebase web sont publiques par nature : elles peuvent être commitées.
- `signInAnonymously()` au chargement de l'app ; bloquer l'UI sur un écran "connexion…" tant que l'auth n'est pas résolue.
- Fournir à la racine du repo un fichier `database.rules.json` (à coller dans la console) :

```json
{
  "rules": {
    "sessions": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

## 0.3 Sessions et rôles

- **Créer une session** (bouton) : génère un code de 6 caractères (A-Z + 2-9, sans O/0/I/1), crée `sessions/{code}/meta` avec `name`, `createdAt`, et un réseau vide.
- **Rejoindre** : champ code + choix de rôle (deux gros boutons **MJ** / **DECKER**). Vérifier que la session existe.
- Support des paramètres d'URL `?session=XXXXXX&role=gm|decker` pour pré-remplir/auto-rejoindre (permet de mettre la partie en favori).
- **Présence** : à la connexion, écrire `meta/gmConnected` ou `meta/deckerConnected` à `true`, avec `onDisconnect().set(false)`. Afficher un indicateur de présence de l'autre rôle dans chaque vue.

## 0.4 Déploiement

- Workflow GitHub Actions `.github/workflows/deploy.yml` : build sur push `main`, déploiement sur GitHub Pages (`actions/deploy-pages`).
- README court : étapes de mise en route (création projet Firebase, où coller la config, activation Anonymous Auth et RTDB, collage des rules, activation de Pages sur le repo).

## Critères d'acceptation Phase 0

1. Deux appareils ouvrent l'URL GitHub Pages, l'un crée une session, l'autre la rejoint avec le code : chacun voit l'indicateur de présence de l'autre passer au vert en < 2 s.
2. Fermer l'onglet d'un rôle fait retomber son indicateur chez l'autre.
3. Rechargement de page avec `?session=…&role=…` : retour direct dans la vue.

---

# PHASE 1 — Carte partagée

## Modèle de données (sous-ensemble RTDB utilisé en Phase 1)

```
sessions/{code}/
  meta/ …                          (Phase 0)
  network/
    nodes/{nodeId}/
      label: string
      type: 'entry'|'firewall'|'database'|'device'|'archive'|'core'
      x: number, y: number         // coordonnées monde (unités arbitraires)
      security: number             // 1..10
      state: 'hidden'|'spotted'|'infiltrated'|'alerted'
      marks: number                // 0..4 — affiché mais non modifiable en Phase 1
      paydata: string|null
      deviceInfo: string|null
    links/{linkId}/ { from, to }
  icons/{iconId}/
    kind: 'ice'|'spider'|'enemyHacker'
    nodeId: string
    iceType: string|null           // parmi les 9 types du CDC, ou null
    revealed: boolean
    visibleToPlayer: boolean
    label: string
    condition: number              // défaut 6
  decker/
    nodeId: string                 // position du persona
```

Types TS correspondants dans `types.ts`. Les `nodeId`/`iconId`/`linkId` sont des push-ids Firebase.

## 1.1 Rendu SVG (composant `NetworkMap`, commun aux deux vues)

- SVG plein conteneur, `viewBox` piloté par un état pan/zoom maison : **pan** = drag un doigt sur le fond, **zoom** = pinch deux doigts + molette (desktop pour le confort de préparation du MJ). Implémentation pointer-events, pas de lib.
- **Nœuds** : formes différenciées par `type` (ex. entry = triangle, firewall = hexagone, database = cylindre stylisé, device = carré, archive = losange, core = cercle double), label en dessous, couleur selon `state` (spotted = contour cyan pâle, infiltrated = cyan plein, alerted = rouge pulsant léger). **Diodes de Marks** : 4 petits plots en arc au-dessus du nœud, allumés selon `marks`.
- **Liens** : lignes avec léger glow, visibles seulement si les deux extrémités sont visibles (règle côté joueur, voir fog of war).
- **Icônes mobiles** : persona du decker (cercle cyan pulsant sur son `nodeId`, décalé pour ne pas masquer le nœud), GLACES (losange rouge ; si `revealed`, afficher un pictogramme/lettre du type et le type en tooltip), spider (araignée stylisée), enemyHacker (cercle magenta). Plusieurs icônes sur un même nœud : disposition en éventail automatique.
- Sélection : tap sur un nœud/icône → surbrillance + remontée au parent (`onSelect`).
- Performance : la carte se re-rend sur mise à jour des stores ; viser la fluidité à ~30 nœuds et ~10 icônes.

## 1.2 Synchro

- `sync/subscribe.ts` : à l'entrée en session, `onValue` sur `network`, `icons`, `decker`, `meta` → stores Zustand. Un seul point d'abonnement, cleanup à la sortie.
- `sync/write.ts` : helpers `updateNode(code, nodeId, partial)`, `moveIcon(…)`, `setDeckerNode(…)`, etc. — toujours des `update()` sur chemins précis, jamais de `set()` global.
- Drag d'un nœud/icône (MJ) : mouvement local optimiste, écriture **throttlée à ~100 ms** pendant le drag + écriture finale au relâchement.

## 1.3 Vue MJ — éditeur et pilotage

Layout paysage : carte au centre, barre d'outils à gauche, panneau de propriétés à droite (s'ouvre sur sélection).

**Toggle Édition / Jeu** en haut.

Mode **Édition** :
- Outil "Ajouter nœud" : tap sur le fond → crée un nœud (type par défaut `device`, security 3) à cet endroit, sélectionné.
- Drag d'un nœud pour le déplacer.
- Outil "Lier" : tap nœud A puis nœud B → crée le lien (re-tap sur un lien = suppression).
- Panneau de propriétés du nœud sélectionné : label, type, security (1-10), state, marks (0-4), paydata, deviceInfo, bouton supprimer.
- Outil "Ajouter GLACE/Spider/Hacker" : tap sur un nœud → crée l'icône dessus ; panneau : kind, iceType (liste des 9 : acide, bloqueuse, brouilleuse, crash, noire, patrouilleuse, potDeColle, traceuse, tueuse), label, condition, toggles `revealed` / `visibleToPlayer`, supprimer.
- Placement du **persona** : bouton "placer le decker ici" sur le nœud sélectionné.
- **Export / Import JSON** du sous-arbre `network` + `icons` (téléchargement de fichier / collage de texte), pour préparer des serveurs hors session et les recharger.

Mode **Jeu** :
- Drag des icônes de nœud en nœud (snap sur le nœud le plus proche au relâchement).
- Sur le nœud sélectionné : boutons rapides changer `state`, ajuster `marks` (+/−).
- Sur l'icône sélectionnée : toggles `revealed` / `visibleToPlayer`.

## 1.4 Vue Decker — fog of war et actions de base

Layout paysage : colonne d'état gauche (placeholder Phase 2 : simple carte d'identité du persona), carte au centre, colonne d'actions à droite, tiroir de log en bas (le log peut rester vide ou logguer les déplacements/scans en attendant la Phase 2).

**Fog of war** (calculé côté client dans le rendu, à partir des mêmes données) :
- `hidden` → le nœud n'est **pas rendu du tout** (ni ses liens).
- `spotted` → silhouette : contour pointillé, label "???", type visible mais pas security/paydata.
- `infiltrated`/`alerted` → rendu complet.
- Icônes : rendues uniquement si `visibleToPlayer` ; type de GLACE affiché uniquement si `revealed`.
- Le decker voit toujours son persona.

**Actions Phase 1** (boutons de la colonne droite, actifs selon le contexte) :
- **Scanner** : révèle les nœuds `hidden` adjacents au nœud courant → `state: 'spotted'`. *(Provisoire : révélation automatique sans jet ; le jet de Perception matricielle arrivera en Phase 2 — isoler l'action dans une fonction `performScan()` facilement branchable sur le futur moteur de jets.)*
- **Se déplacer** : après sélection d'un nœud adjacent non-`hidden`, bouton "Se déplacer ici" → `decker/nodeId`. *(Provisoire : pas encore d'exigence de Mark — la contrainte "≥ 1 Mark" arrive en Phase 2 ; laisser un commentaire TODO à l'endroit du contrôle.)*
- Panneau d'info du nœud sélectionné : ce que le joueur a le droit de voir selon le state.

## 1.5 Responsive smartphone paysage

Breakpoint sur la hauteur (`< 500px`) : colonnes gauche/droite deviennent des tiroirs (boutons d'ouverture ancrés aux bords), carte plein écran. Vérifier que tous les taps restent ≥ 40 px de zone tactile.

## Critères d'acceptation Phase 1

1. Le MJ construit un réseau de 8 nœuds avec liens, 2 GLACES et de la paydata, l'exporte en JSON, vide la session, le réimporte : identique.
2. Tout changement MJ (déplacement d'icône, state d'un nœud) apparaît chez le Decker en < 1 s, et réciproquement (déplacement du persona, scan).
3. Côté Decker : un nœud `hidden` est totalement invisible ; Scanner sur le nœud courant fait apparaître ses voisins en silhouette ; une GLACE `visibleToPlayer:false` est invisible, `revealed:false` est un losange anonyme.
4. Pan/zoom fluide au doigt sur tablette ; l'app reste utilisable en smartphone paysage avec les tiroirs.
5. `npm run build` sans erreur TS ; déploiement Pages fonctionnel.

## Hors périmètre (ne pas implémenter)

Jets de dés, réserves, Chance, Marks automatiques, approches Force Brute/Corruption, moniteurs de condition, Surveillance/DIEU, cybercombat, contre-mesures, mini-jeux, sons. Prévoir seulement les emplacements (placeholders discrets) dans les layouts.
