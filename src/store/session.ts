import { create } from 'zustand';
import type { Role } from '../types';

interface SessionStore {
  /** Auth anonyme Firebase résolue. */
  authReady: boolean;
  authError: string | null;
  /** Code de la session en cours (null = écran d'accueil). */
  code: string | null;
  role: Role | null;
  setAuthReady: () => void;
  setAuthError: (message: string) => void;
  enter: (code: string, role: Role) => void;
  leave: () => void;
}

/** Reflète la session dans l'URL (?session=…&role=…) pour permettre le favori. */
function syncUrl(code: string | null, role: Role | null) {
  const url = new URL(window.location.href);
  if (code && role) {
    url.searchParams.set('session', code);
    url.searchParams.set('role', role);
  } else {
    url.searchParams.delete('session');
    url.searchParams.delete('role');
  }
  window.history.replaceState(null, '', url);
}

export const useSessionStore = create<SessionStore>((set) => ({
  authReady: false,
  authError: null,
  code: null,
  role: null,
  setAuthReady: () => set({ authReady: true, authError: null }),
  setAuthError: (message) => set({ authError: message }),
  enter: (code, role) => {
    syncUrl(code, role);
    set({ code, role });
  },
  leave: () => {
    syncUrl(null, null);
    set({ code: null, role: null });
  },
}));
