# Decker Console

Compagnon de jeu web pour les phases de hacking d'une campagne **Shadowrun Anarchy** :
un **MJ** et un **Decker** connectés en temps réel (Firebase RTDB), carte réseau SVG
avec brouillard de guerre. Voir `cahier-des-charges-decker.md` pour le périmètre complet.

État actuel : **Phases 0 à 5 complètes** — version jouable avec moteur de règles,
menaces, cinq mini-jeux, sons, animations, convergence DIEU et bibliothèque de
réseaux.

## Mise en route

### 1. Projet Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Créer un projet** (Analytics inutile).
2. **Créer une application Web** (icône `</>`), copier l'objet `firebaseConfig`.
3. **Authentication** → Méthodes de connexion → activer **Anonyme**.
4. **Realtime Database** → Créer une base (mode verrouillé, région au choix, ex. `europe-west1`).
5. Onglet **Règles** de la RTDB → coller le contenu de [`database.rules.json`](database.rules.json) → Publier.

### 2. Config locale

Coller les valeurs de `firebaseConfig` dans [`src/firebase.config.ts`](src/firebase.config.ts)
(les clés Firebase web sont publiques par nature, elles peuvent être commitées).

```bash
npm install
npm run dev
```

Ouvrir deux onglets : créer une session dans l'un (rôle MJ), la rejoindre avec le
code dans l'autre (rôle Decker).

### 3. Déploiement GitHub Pages

1. Créer un repo GitHub nommé **`decker-console`** (sinon, adapter `base` dans
   [`vite.config.ts`](vite.config.ts)).
2. Pousser la branche `main` :
   ```bash
   git remote add origin https://github.com/<votre-compte>/decker-console.git
   git push -u origin main
   ```
3. Sur le repo : **Settings → Pages → Source : GitHub Actions**.
4. Le workflow [`deploy.yml`](.github/workflows/deploy.yml) construit et publie à
   chaque push sur `main`. L'app est servie sur
   `https://<votre-compte>.github.io/decker-console/`.

## Utilisation

- **Accueil** : créer une session (génère un code 6 caractères) ou rejoindre avec
  code + rôle. L'URL `?session=CODE&role=gm|decker` permet de garder un favori.
- **Vue MJ** : mode **Édition** (poser nœuds, liens, GLACES/Spiders/Hackers,
  propriétés, export/import JSON du réseau, placer le persona) ↔ mode **Jeu**
  (déplacer les icônes, changer états et marks, révéler/masquer au joueur).
- **Vue Decker** : carte avec brouillard de guerre, **Scanner** (révèle les nœuds
  adjacents), jets et actions matricielles, moniteurs et menace, **Se déplacer**
  (nœud adjacent visible), log terminal en tiroir. Après un jet de Corruption,
  **Injection de code** propose une résolution tactile de type Mastermind.
- **Vue MJ** : le panneau de jeu affiche la progression du mini-jeu en direct et
  permet de le passer en réussite ou de forcer son échec.
- **Mini-jeux** : Injection de code (Corruption), Surcharge (Force Brute),
  Décryptage (paydata), Extraction d'urgence (Pot de colle) et Brouillage
  (Traceuse). Leur difficulté dépend des succès du jet initial.
- **Polish** : sons synthétiques activables depuis les vues MJ/Decker, alertes
  et GLACES animées, écran de convergence DIEU renforcé. L'outil
  **Export / Import** propose aussi trois réseaux prêts à jouer.

Cible d'affichage : tablette **paysage** ; utilisable en smartphone paysage
(colonnes repliées en tiroirs). Portrait : écran « tournez l'écran ».

## Stack

Vite · React 18 · TypeScript · Tailwind CSS v4 · Zustand · Firebase (RTDB +
Anonymous Auth) · SVG natif (pan/zoom maison) · GitHub Pages.
