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
  sub('decker', (v) => useNetworkStore.setState({ decker: (v as never) ?? {} }));
  sub('environment', (v) => useNetworkStore.setState({ environment: (v as never) ?? {} }));
  sub('countdowns', (v) => useNetworkStore.setState({ countdowns: (v as never) ?? {} }));
  sub('lastRoll', (v) => useNetworkStore.setState({ lastRoll: (v as never) ?? null }));
  sub('lastAttack', (v) =>
    // La valeur et son flag d'hydratation sont posés atomiquement : le premier
    // rendu qui voit lastAttackHydrated=true voit aussi la vraie valeur (ou
    // null), ce qui évite toute course entre « pas encore chargé » et « aucune
    // attaque ». Sans ça, la première attaque d'une session était avalée comme
    // une hydratation et n'affichait pas de popup.
    useNetworkStore.setState({ lastAttack: (v as never) ?? null, lastAttackHydrated: true }),
  );
  sub('minigame', (v) => useNetworkStore.setState({ minigame: (v as never) ?? null }));
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
