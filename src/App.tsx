import { useEffect } from 'react';
import { isConfigPlaceholder } from './firebase.config';
import { signIn } from './firebase';
import { useSessionStore } from './store/session';
import { subscribeToSession } from './sync/subscribe';
import Home from './screens/Home';
import GmView from './screens/GmView';
import DeckerView from './screens/DeckerView';
import { PortraitOverlay } from './components/ui';
import { SessionSoundscape } from './components/SessionSoundscape';

function ConfigMissing() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="glow-text text-2xl text-neon-red">FIREBASE NON CONFIGURÉ</h1>
      <p className="max-w-xl text-sm leading-6 text-ink">
        Collez la configuration de votre projet Firebase dans{' '}
        <code className="text-neon-cyan">src/firebase.config.ts</code>{' '}
        (console Firebase → Paramètres du projet → Vos applications → Config),
        puis rechargez la page. Voir le README pour le pas-à-pas complet.
      </p>
    </div>
  );
}

function Connecting({ error }: { error: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      {error ? (
        <>
          <p className="glow-text text-neon-red">ERREUR DE CONNEXION</p>
          <p className="max-w-md text-center text-sm text-ink-dim">{error}</p>
        </>
      ) : (
        <p className="pulse-slow glow-text tracking-[0.3em] text-neon-cyan">
          CONNEXION…
        </p>
      )}
    </div>
  );
}

export default function App() {
  const { authReady, authError, code, role, setAuthReady, setAuthError } =
    useSessionStore();

  useEffect(() => {
    if (isConfigPlaceholder) return;
    signIn()
      .then(() => setAuthReady())
      .catch((e: unknown) =>
        setAuthError(e instanceof Error ? e.message : String(e)),
      );
  }, [setAuthReady, setAuthError]);

  // Abonnement RTDB unique, lié au cycle de vie de la session courante.
  useEffect(() => {
    if (!authReady || !code || !role) return;
    return subscribeToSession(code, role);
  }, [authReady, code, role]);

  let screen;
  if (isConfigPlaceholder) screen = <ConfigMissing />;
  else if (!authReady) screen = <Connecting error={authError} />;
  else if (!code || !role) screen = <Home />;
  else if (role === 'gm') screen = <GmView />;
  else screen = <DeckerView />;

  return (
    <div className="screen-shell h-full overflow-hidden">
      {screen}
      {code && role && <SessionSoundscape />}
      <PortraitOverlay />
    </div>
  );
}
