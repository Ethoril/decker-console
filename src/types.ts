// Types du modèle de données RTDB — sous-ensemble Phases 0 + 1 (cf. brief).

export type Role = 'gm' | 'decker';

export type NodeType = 'entry' | 'firewall' | 'database' | 'device' | 'archive' | 'core';

export type NodeState = 'hidden' | 'spotted' | 'infiltrated' | 'alerted';

export type IceType =
  | 'acide'
  | 'bloqueuse'
  | 'brouilleuse'
  | 'crash'
  | 'noire'
  | 'patrouilleuse'
  | 'potDeColle'
  | 'traceuse'
  | 'tueuse';

export type IconKind = 'ice' | 'spider' | 'enemyHacker';

export interface NetworkNode {
  label: string;
  type: NodeType;
  x: number;
  y: number;
  security: number; // 1..10
  state: NodeState;
  marks: number; // 0..4 — affiché, non modifiable par le joueur en Phase 1
  paydata?: string | null;
  deviceInfo?: string | null;
}

export interface Link {
  from: string;
  to: string;
}

export interface MatrixIcon {
  kind: IconKind;
  nodeId: string;
  iceType?: IceType | null;
  revealed: boolean;
  visibleToPlayer: boolean;
  label: string;
  condition: number; // défaut 6
  /** Hacker ennemi : réserves libres saisies par le MJ (CDC §4.3). */
  atkPool?: number;
  defPool?: number;
}

export type ConnectionMode = 'AR' | 'VR' | 'HOTSIM';

export type ProgramState = 'active' | 'crashed';

/** Sous-arbre decker/ — Phases 2+3 : position, mode, moniteurs, menace. */
export interface DeckerState {
  nodeId?: string | null;
  mode?: ConnectionMode; // compatibilité des anciennes sessions ; jeu toujours en RA
  stun?: number; // cases étourdissantes cochées
  physical?: number; // cases physiques cochées
  deckCondition?: number; // 0..9 cases cochées (Cyber-5)
  firewallPenalty?: number; // cumul GLACE Acide (durée scène)
  luck?: number; // points de Chance restants (init 2)
  programs?: { marteau?: ProgramState; discretion?: ProgramState };
  debuffs?: Record<string, boolean>; // ex. { bloqueuse: true }
  surveillance?: number; // 0..3 — JAUGE DIEU, jamais affichée au joueur sans action
  surveillanceRevealed?: boolean; // 10 s après « Vérifier », puis retombe
  rebootCountdown?: number; // > 0 = deck inactif
  trapped?: boolean; // Pot de colle actif → déconnexion interdite
  convergence?: boolean; // séquence DIEU en cours (plein écran rouge joueur)
  traceDelay?: number; // tours gagnés par Brouillage avant localisation
}

/** Sous-arbre environment/ — malus d'environnement + buff système (CDC §2). */
export interface EnvironmentState {
  noise?: 0 | 2 | 3 | 4;
  wifiDistance?: 0 | 2 | 4;
  /** « +N au prochain jet du système » (alarme silencieuse) — consommé au jet. */
  systemBuff?: number;
}

/** Sous-arbre countdowns/ — « équipe physique dans N tours » (palier 10). */
export interface CountdownsState {
  intervention?: number | null;
}

/** Une ligne du composeur de réserve, désactivable individuellement. */
export interface PoolLine {
  id: string;
  label: string;
  value: number; // positif (bonus) ou négatif (malus)
  enabled: boolean;
}

/** Dernier jet publié — miroir MJ (dé de complication inclus). */
export interface RollRecord {
  ts: number;
  action: string; // ex. « Hack (Corruption) — Serveur RH »
  lines: Array<{ label: string; value: number }>; // lignes retenues
  pool: number;
  dice: number[]; // résultats finaux (après relance éventuelle)
  successes: number;
  successOn: 4 | 5; // seuil de succès (4 si Chance dépensée)
  luckUsed: boolean;
  rerolled: boolean;
  /** Dé de complication (tests de Hacking uniquement, sinon 0). Visible MJ seul. */
  complication: number;
  outcome: string; // résumé de l'effet appliqué
}

export type MiniGameKind =
  | 'injection'
  | 'overload'
  | 'decryption'
  | 'extraction'
  | 'jamming';
export type MiniGameStatus = 'active' | 'success' | 'failure';

export interface InjectionParams {
  sequenceLength: number;
  alphabetSize: number;
  maxAttempts: number;
}

export interface OverloadParams {
  zoneWidth: number;
  speed: number;
  requiredHits: number;
}

export interface DecryptionParams {
  gridSize: number;
  timeLimit: number;
}

export interface ExtractionParams {
  gridSize: number;
  timeLimit: number;
}

export interface JammingParams {
  duration: number;
  spawnInterval: number;
  maxMisses: number;
}

export type MiniGameParams =
  | InjectionParams
  | OverloadParams
  | DecryptionParams
  | ExtractionParams
  | JammingParams;

export interface MiniGameProgress {
  label: string;
  value: number;
  total: number;
  detail?: string;
}

export interface HackMiniGameContext {
  type: 'hack';
  nodeId: string;
  approach: 'bruteForce' | 'corruption';
  /** Succès du jet initial ; un mini-jeu réussi garantit au moins 1 Mark. */
  rollSuccesses: number;
}

export interface PaydataMiniGameContext {
  type: 'paydata';
  nodeId: string;
  rollSuccesses: number;
}

export interface EscapeMiniGameContext {
  type: 'escape';
  rollSuccesses: number;
}

export interface TraceMiniGameContext {
  type: 'trace';
  rollSuccesses: number;
}

export type MiniGameContext =
  | HackMiniGameContext
  | PaydataMiniGameContext
  | EscapeMiniGameContext
  | TraceMiniGameContext;

export type MiniGameRequestContext =
  | Omit<HackMiniGameContext, 'rollSuccesses'>
  | Omit<PaydataMiniGameContext, 'rollSuccesses'>
  | Omit<EscapeMiniGameContext, 'rollSuccesses'>
  | Omit<TraceMiniGameContext, 'rollSuccesses'>;

/** État temps réel d'un mini-jeu, affiché au joueur et en miroir chez le MJ. */
export interface MiniGameState {
  id: string;
  kind: MiniGameKind;
  status: MiniGameStatus;
  action: string;
  startedAt: number;
  completedAt?: number;
  params: MiniGameParams;
  progress: MiniGameProgress;
  context: MiniGameContext;
}

export interface SessionMeta {
  name: string;
  createdAt: number;
  gmConnected: boolean;
  deckerConnected: boolean;
}

export type LogKind = 'action' | 'roll' | 'damage' | 'alert' | 'gm' | 'system';

export interface LogEntry {
  ts: number;
  kind: LogKind;
  text: string;
  visibility: 'all' | 'gm';
}

/** Issue d'une attaque *subie* par le decker (pour la notification joueur). */
export type AttackOutcome =
  | 'dodged' // esquivée (jet de défense gagné)
  | 'blocked' // parée par le Firewall
  | 'deckDamage' // dégâts au deck
  | 'physicalDamage' // dégâts physiques (GLACE Noire)
  | 'convergence'; // le DIEU grille le deck

/**
 * Événement structuré d'attaque contre le decker, écrit en miroir par le
 * moteur de menace (game/threat.ts) et consommé par la vue Decker. Remplace
 * le parsing fragile du journal : la source décide, l'UI ne fait qu'afficher.
 */
export interface AttackEvent {
  id: string; // clé unique (détection de nouvel événement, anti-rejeu)
  ts?: number;
  attacker: string; // nom affiché de la source de l'attaque
  outcome: AttackOutcome;
  amount?: number; // dégâts infligés, si applicable
  detail?: string; // complément court, ex. « 3 vs 1 » (succès attaque vs défense)
}

/** Forme du fichier d'export/import JSON du réseau (vue MJ). */
export interface NetworkExport {
  network: {
    nodes: Record<string, NetworkNode> | null;
    links: Record<string, Link> | null;
  };
  icons: Record<string, MatrixIcon> | null;
  decker?: DeckerState | null;
}
