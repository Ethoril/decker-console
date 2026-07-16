import { create } from 'zustand';
import type {
  DeckerState,
  EnvironmentState,
  LogEntry,
  Link,
  MatrixIcon,
  NetworkNode,
  RollRecord,
  SessionMeta,
} from '../types';

/** Miroir local (lecture seule) du sous-arbre sessions/{code} de la RTDB. */
interface NetworkStore {
  meta: SessionMeta | null;
  nodes: Record<string, NetworkNode>;
  links: Record<string, Link>;
  icons: Record<string, MatrixIcon>;
  decker: DeckerState;
  environment: EnvironmentState;
  lastRoll: RollRecord | null;
  log: Record<string, LogEntry>;
  reset: () => void;
}

const empty = {
  meta: null,
  nodes: {},
  links: {},
  icons: {},
  decker: {} as DeckerState,
  environment: {} as EnvironmentState,
  lastRoll: null,
  log: {},
};

export const useNetworkStore = create<NetworkStore>((set) => ({
  ...empty,
  reset: () => set({ ...empty }),
}));

// Valeurs par défaut des champs decker non initialisés (session fraîche).
export const deckerDefaults = {
  mode: 'AR' as const,
  stun: 0,
  physical: 0,
  luck: 2,
};
