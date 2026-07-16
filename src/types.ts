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
}

/** Sous-arbre decker/ — Phase 1 : seulement la position. */
export interface DeckerState {
  nodeId?: string | null;
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
