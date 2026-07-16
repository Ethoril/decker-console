import { create } from 'zustand';
import type { LogEntry, Link, MatrixIcon, NetworkNode, SessionMeta } from '../types';

/** Miroir local (lecture seule) du sous-arbre sessions/{code} de la RTDB. */
interface NetworkStore {
  meta: SessionMeta | null;
  nodes: Record<string, NetworkNode>;
  links: Record<string, Link>;
  icons: Record<string, MatrixIcon>;
  deckerNodeId: string | null;
  log: Record<string, LogEntry>;
  reset: () => void;
}

const empty = {
  meta: null,
  nodes: {},
  links: {},
  icons: {},
  deckerNodeId: null,
  log: {},
};

export const useNetworkStore = create<NetworkStore>((set) => ({
  ...empty,
  reset: () => set({ ...empty }),
}));
