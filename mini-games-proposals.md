# Spécifications des Nouveaux Mini-Jeux Cyberpunk

Ce document détaille l'architecture game design et technique des 3 nouveaux mini-jeux pour la console Decker Shadowrun.

---

## 1. Analyse de Signal (`signal`) — Bypass de Pare-feu / Glace

### 🎯 Thématique & Contexte
Le hacker tente de s'aligner sur la fréquence d'onde d'une Glace ou d'un pare-feu pour annuler sa signature réseau et s'infiltrer sans être détecté.

### 🕹️ Mécanique de Jeu
- Un écran de type **Oscilloscope/Analyseur de spectre** affiche deux ondes :
  1. **L'onde cible** (rouge/magenta néon, fixe ou pulsante).
  2. **L'onde du decker** (cyan néon, réactive aux contrôles).
- **Contrôles** : 3 curseurs fluides (sliders) :
  - **Amplitude** (Hauteur des pics)
  - **Fréquence** (Nombre de cycles)
  - **Phase** (Décalage horizontal)
- **Condition de victoire** : Maintenir l'onde du decker superposée à l'onde cible avec au moins 92% de correspondance pendant 2.0 secondes consécutives (remplit une jauge de synchronisation).
- **Chrono** : Temps imparti limité.

### ⚙️ Équilibrage & Paramètres (`SignalParams`)
```typescript
export interface SignalParams {
  /** Marge d'erreur tolérée sur les curseurs (ex: 0.08 = 8%) */
  tolerance: number;
  /** Temps en secondes de maintien requis (ex: 2.0s) */
  holdTime: number;
  /** Temps limite total (ex: 25s) */
  timeLimit: number;
  /** Nombre de curseurs actifs (2 à 3 selon la difficulté) */
  sliderCount: 2 | 3;
}
```
- **Facile (4+ succès)** : 2 curseurs (Amplitude, Fréquence), tolérance 12%, 1.5s de maintien, 30s.
- **Moyen (2-3 succès)** : 3 curseurs, tolérance 8%, 2.0s de maintien, 25s.
- **Difficile (1 succès)** : 3 curseurs, tolérance 5%, 2.5s de maintien, 20s.
- **Expert (0 succès)** : 3 curseurs avec cible en mouvement sinusoïdal lent, tolérance 4%, 20s.

---

## 2. Matrice de Séquençage (`sequence`) — Memory Hack / Cryptographie

### 🎯 Thématique & Contexte
Infiltration des registres de mémoire d'un sous-système. Le système émet une clé de sécurité dynamique que le decker doit mémoriser et reproduire sous pression.

### 🕹️ Mécanique de Jeu
- Une grille de **3×3 ou 4×4 pavés lumineux cyberpunk**.
- **Phase de démo (Émission)** : Une suite de pavés s'illumine avec des sons/flashs néon à un rythme régulier.
- **Phase de réplication (Réponse)** : Le joueur doit cliquer/taper sur les pavés dans le même ordre.
- **Progression** : Rétroaction visuelle immédiate (vert néon si correct, rouge néon + alarme si erreur). Une erreur réinitialise la séquence en cours.
- **Condition de victoire** : Valider N séquences de longueur croissante.

### ⚙️ Équilibrage & Paramètres (`SequenceParams`)
```typescript
export interface SequenceParams {
  /** Taille de la grille (3 pour 3x3, 4 pour 4x4) */
  gridSize: 3 | 4;
  /** Longueur de la séquence à reproduire (ex: 4 à 7 pavés) */
  sequenceLength: number;
  /** Vitesse d'affichage par pavé en millisecondes (ex: 400ms) */
  displaySpeedMs: number;
  /** Nombre d'erreurs autorisées (ex: 1 à 2) */
  maxErrors: number;
}
```
- **Facile (4+ succès)** : Grille 3×3, séquence de 4 pavés, vitesse 550ms, 2 erreurs permises.
- **Moyen (2-3 succès)** : Grille 3×3, séquence de 5 pavés, vitesse 450ms, 1 erreur permise.
- **Difficile (1 succès)** : Grille 4×4, séquence de 6 pavés, vitesse 380ms, 1 erreur permise.
- **Expert (0 succès)** : Grille 4×4, séquence de 7 pavés, vitesse 300ms, 0 erreur permise.

---

## 3. Siphon de Flux (`siphon`) — Extraction de Données Matrix

### 🎯 Thématique & Contexte
Vol de données Paydata à haut débit dans un pipeline réseau surchargé. Le decker doit intercepter les paquets de données chiffrés valides parmi les paquets corrompus ou piégés (Glace).

### 🕹️ Mécanique de Jeu
- 3 à 4 **canaux/colonnes verticales** dans lesquelles défilent des paquets de données du haut vers le bas (effet Matrix rain/cyberpunk).
- **Types de paquets** :
  - 🟩 **Paquets Data (Vert/Cyan)** : À intercepter impérativement (+1 point).
  - 🟥 **Paquets Piégés / Glace (Rouge/Magenta)** : À éviter absolument (-1 point + flash de dégâts).
  - 🟨 **Paquets Bonbon / Data Denses (Or/Jaune)** : Bonus (+2 points).
- **Contrôles** : Tap/Clic direct sur les paquets valides lorsqu'ils traversent la ligne d'interception ou défilent sur les canaux.
- **Condition de victoire** : Récolter K paquets de données valides avant expiration du temps.

### ⚙️ Équilibrage & Paramètres (`SiphonParams`)
```typescript
export interface SiphonParams {
  /** Nombre de colonnes de défilement (3 à 4) */
  columns: 3 | 4;
  /** Nombre de paquets valides requis pour gagner (ex: 10 à 15) */
  requiredData: number;
  /** Vitesse de défilement des paquets (px/sec) */
  fallSpeed: number;
  /** Temps limite en secondes */
  timeLimit: number;
}
```
- **Facile (4+ succès)** : 3 colonnes, 8 paquets requis, vitesse lente, 25s.
- **Moyen (2-3 succès)** : 3 colonnes, 12 paquets requis, vitesse moyenne, 22s.
- **Difficile (1 succès)** : 4 colonnes, 15 paquets requis, vitesse rapide avec paquets piégés, 20s.
- **Expert (0 succès)** : 4 colonnes, 18 paquets requis, très rapide, 18s.

---

## Intégration dans le Codebase

1. **Extension du type `MiniGameKind`** dans `src/types.ts` :
   `export type MiniGameKind = 'injection' | 'overload' | 'decryption' | 'extraction' | 'signal' | 'sequence' | 'siphon';`
2. **Composants dans `src/minigames/`** :
   - `src/minigames/signal/SignalGame.tsx`
   - `src/minigames/sequence/SequenceGame.tsx`
   - `src/minigames/siphon/SiphonGame.tsx`
3. **Mise à jour des sélecteurs et du bac à sable GM (`MinigameSandboxModal.tsx`)**.
