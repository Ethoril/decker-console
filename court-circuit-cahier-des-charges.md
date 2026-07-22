# Cahier des charges — Mini-jeu « Court-circuit » (Lights Out)

Kind : `shortcircuit` · Label : **Court-circuit** · Fichier : `src/minigames/shortcircuit/ShortCircuitGame.tsx`

## 1. Concept & thème

Le decker doit **neutraliser une grille de capteurs d'alarme**. Chaque capteur est
allumé (rouge/ambre = actif) ou éteint (sombre). Toucher un capteur inverse son
état **et celui de ses 4 voisins orthogonaux** (haut/bas/gauche/droite). But :
**tout éteindre** avant la fin du chrono.

C'est un « Lights Out » classique. Mécanique nouvelle (logique de parité) — ne
pas confondre avec `decryption` (rotation de circuit) ni `sequence` (mémoire).

## 2. Règles

- Grille carrée `gridSize × gridSize`.
- Un clic/tap sur une case **(r,c)** bascule (`on↔off`) la case elle-même + les
  voisines orthogonales existantes (les bords ont moins de voisins — normal).
- Les bascules sont commutatives et involutives (2 clics sur la même case =
  retour à l'état initial). L'ordre n'a aucune importance.
- **Victoire** : toutes les cases éteintes → `onResult(true)`.
- **Défaite** : chrono écoulé → `onResult(false)`.

## 3. Solvabilité GARANTIE (critique — cf. échec de Glyph)

**Ne jamais générer un état aléatoire brut** (tous les états 5×5 ne sont pas
solubles). Génération obligatoire :

1. Partir de la grille **tout éteint** (état résolu).
2. Appliquer `scrambleMoves` bascules sur des cases **choisies aléatoirement**
   (chaque bascule applique la règle case+voisins).
3. L'état obtenu est **toujours soluble** (il suffit de rejouer les mêmes cases).
4. **Anti-victoire immédiate** : si après le brouillage la grille est déjà tout
   éteinte (les bascules se sont annulées), continuer à basculer des cases
   aléatoires jusqu'à ce qu'au moins une case soit allumée. Le jeu ne doit
   JAMAIS s'ouvrir sur un état déjà gagné.

Note : la solution minimale peut compter moins de coups que `scrambleMoves` — sans
importance, on ne compte pas les coups pour la victoire.

## 4. Paramètres & équilibrage

```typescript
export interface ShortCircuitParams {
  gridSize: 3 | 4 | 5;
  scrambleMoves: number; // nombre de bascules initiales
  timeLimit: number;     // secondes
}
```

| Difficulté            | successes | gridSize | scrambleMoves | timeLimit |
|-----------------------|-----------|----------|---------------|-----------|
| Facile                | `>= 4`    | 3        | 3             | 40        |
| Moyen                 | `>= 2`    | 4        | 5             | 40        |
| Difficile             | `=== 1`   | 4        | 8             | 35        |
| Très difficile        | `else`    | 5        | 12            | 30        |

## 5. Intégration — fichiers à modifier (checklist)

Suivre **exactement** le patron des jeux existants.

1. **`src/types.ts`**
   - Ajouter `'shortcircuit'` à l'union `MiniGameKind`.
   - Ajouter l'interface `ShortCircuitParams`.
   - Ajouter `ShortCircuitParams` à l'union `MiniGameParams`.

2. **`src/game/minigames.ts`**
   - Importer `ShortCircuitParams` (ordre alphabétique des imports type).
   - `MINI_GAME_LABELS` : `shortcircuit: 'Court-circuit'`.
   - `pickMiniGameKind` : ajouter `'shortcircuit'` au tableau `allKinds`.
   - Exporter `shortCircuitParams(successes: number): ShortCircuitParams` (table §4).
   - `paramsFor` : `case 'shortcircuit': return shortCircuitParams(successes);`.
   - `totalFor` : `if (kind === 'shortcircuit') return (params as ShortCircuitParams).gridSize ** 2;`.

3. **`src/minigames/shortcircuit/ShortCircuitGame.tsx`** — le composant (voir §6).

4. **`src/components/decker/RollModal.tsx`**
   - Importer `ShortCircuitParams` (type) et `ShortCircuitGame`.
   - Ajouter le `case 'shortcircuit'` qui rend `<ShortCircuitGame params={activeGame.params as ShortCircuitParams} {...common} />`.

5. **`src/components/gm/MinigameSandboxModal.tsx`**
   - Importer le type `ShortCircuitParams`, la fonction `shortCircuitParams`, le composant `ShortCircuitGame`.
   - `gameParams` switch : `case 'shortcircuit': return shortCircuitParams(successes);`.
   - Bloc d'aperçu HUD (grille 2 ou 3 colonnes façon les autres) affichant Grille, Bascules, Temps.
   - Bloc de rendu dans la vue « running » : `{kind === 'shortcircuit' && (<ShortCircuitGame key={gameKey} params={gameParams as ShortCircuitParams} onProgress={handleProgress} onResult={handleResult} />)}`.

> Aucune modification de `NodePanel` nécessaire (il liste `MINI_GAME_LABELS`
> automatiquement). Le sélecteur de mini-jeu forcé prendra donc `Court-circuit`
> tout seul.

## 6. Contrat du composant & conventions UI

Signature (comme tous les jeux) :

```tsx
import type { MiniGameProgress, ShortCircuitParams } from '../../types';
import type { MiniGameProps } from '../types';

export function ShortCircuitGame({ params, onProgress, onResult }:
  MiniGameProps<ShortCircuitParams, MiniGameProgress>) { ... }
```

Reprendre le squelette d'un jeu existant (ex. `SequenceGame`) pour l'homogénéité :

- **État & refs** : `const finished = useRef(false)` (garde anti-double-résultat) ;
  `secondsRef` pour le chrono si besoin dans un callback.
- **Grille initiale** : `useMemo` (deps `[params.gridSize, params.scrambleMoves]`)
  produisant l'état de départ selon §3.
- **Écran tutoriel** : state `showTutorial` (true au départ), même structure/classes
  que les autres (`glitch-text`, encart néon, bouton `btn btn-cyan`). Titre :
  « Court-circuit ». Expliquer : toucher une case inverse la case + ses voisines ;
  but = tout éteindre avant `{params.timeLimit}s`.
- **Chrono** : `useEffect` `setInterval` 1 s ; à 0 → `onResult(false)` (garde
  `finished`). Ne pas démarrer tant que `showTutorial` est vrai.
- **HUD haut** : identique aux autres — pastille de progression à gauche
  (« Capteurs actifs : X »), **chrono agrandi** à droite (mêmes classes que
  `SequenceGame`/`DecryptionGame` : `border-2 font-mono`, rouge+pulse si `<= 6`),
  + barre de progression dégradée `from-neon-blue via-neon-cyan to-neon-green`.
- **Progression** (`onProgress`) à chaque coup :
  `{ label: 'Capteurs neutralisés', value: éteintes, total: gridSize², detail: `${allumées} capteurs actifs` }`.
- **Grille** : `grid` responsive, `gridTemplateColumns: repeat(gridSize, minmax(0,1fr))`,
  `aspect-square`, `max-h-[calc(100vh-170px)]`. Case allumée = néon vif
  (`border-neon-red bg-neon-red/30 shadow-[0_0_16px_...]` ou ambre), case éteinte
  = sombre (`border-grid bg-panel-2`). Transition douce, `active:scale-95`.
- **Victoire** : quand toutes les cases éteintes → `finished.current = true` puis
  `window.setTimeout(() => onResult(true), 250)`.

## 7. Pièges à éviter (leçons des versions précédentes)

- **Solvabilité** : jamais d'état aléatoire brut ; toujours brouiller depuis
  l'état résolu (§3). **Et** empêcher l'ouverture sur un état déjà gagné.
- **Tactile** : mettre **un seul** handler (`onClick` OU `onPointerDown` avec
  `e.preventDefault()`), **jamais les deux** `onPointerDown` + `onTouchStart` en
  même temps (double-déclenchement constaté sur Siphon).
- **Pureté** : ne pas appeler `onProgress`/`onResult` **dans** un updater
  `setState(prev => …)`. Calculer le prochain état, `setState(next)`, **puis**
  déclencher les callbacks.
- **Garde `finished`** : tout chemin vers `onResult` doit être protégé pour éviter
  les doubles résolutions (chrono vs victoire).
- Pas d'export non-composant dans le fichier du jeu (règle lint `react-refresh`).

## 8. Critères d'acceptation (ce que je vérifierai)

- [ ] `npx tsc --noEmit` et `npx eslint src` sans nouvelle erreur.
- [ ] Câblage complet des 5 fichiers d'intégration (§5) ; le jeu apparaît dans la
      sandbox MJ et dans le sélecteur de mini-jeu forcé.
- [ ] Grille **toujours soluble** et **jamais gagnée d'entrée** (tester plusieurs
      lancements à chaque difficulté, dont 5×5).
- [ ] Un tap inverse bien case + 4 voisins ; bords gérés correctement.
- [ ] Victoire = toutes éteintes ; défaite = chrono à 0 ; pas de double `onResult`.
- [ ] Pas de double-comptage au tactile ; jouable au doigt.
- [ ] HUD/tutoriel cohérents visuellement avec les autres jeux.
