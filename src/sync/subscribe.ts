import { onDisconnect, onValue, ref, set } from 'firebase/database';
import { getDb } from '../firebase';
import { useNetworkStore } from '../store/network';
import type { Role } from '../types';

/**
 * Point d'abonnement unique à une session : hydrate le store network
 * depuis la RTDB et gère la présence du rôle courant (onDisconnect).
 * Retourne la fonction de cleanup (à appeler en quittant la session).
 */
export function subscribeToSession(code: string, role: Role): () => void {
  const db = getDb();
  const offs: Array<() => void> = [];

  const sub = (path: string, apply: (value: unknown) => void) => {
    const unsubscribe = onValue(ref(db, `sessions/${code}/${path}`), (snap) => {
      apply(snap.val());
    });
    offs.push(unsubscribe);
  };

  sub('meta', (v) => useNetworkStore.setState({ meta: (v as never) ?? null }));
  sub('network', (v) => {
    const network = (v ?? {}) as { nodes?: never; links?: never };
    useNetworkStore.setState({
      nodes: network.nodes ?? {},
      links: network.links ?? {},
    });
  });
  sub('icons', (v) => useNetworkStore.setState({ icons: (v as never) ?? {} }));
  sub('decker', (v) => {
    const decker = (v ?? {}) as { nodeId?: string };
    useNetworkStore.setState({ deckerNodeId: decker.nodeId ?? null });
  });
  sub('log', (v) => useNetworkStore.setState({ log: (v as never) ?? {} }));

  // Présence : posée à chaque (re)connexion au serveur RTDB.
  const presenceRef = ref(
    db,
    `sessions/${code}/meta/${role === 'gm' ? 'gmConnected' : 'deckerConnected'}`,
  );
  const offConnected = onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() === true) {
      void onDisconnect(presenceRef).set(false);
      void set(presenceRef, true);
    }
  });
  offs.push(offConnected);

  return () => {
    offs.forEach((off) => off());
    void onDisconnect(presenceRef).cancel();
    void set(presenceRef, false);
    useNetworkStore.getState().reset();
  };
}
