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
  mode?: ConnectionMode; // défaut AR
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

/** Forme du fichier d'export/import JSON du réseau (vue MJ). */
export interface NetworkExport {
  network: {
    nodes: Record<string, NetworkNode> | null;
    links: Record<string, Link> | null;
  };
  icons: Record<string, MatrixIcon> | null;
  decker?: DeckerState | null;
}
