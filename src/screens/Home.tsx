import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../store/session';
import { createSession, sessionExists } from '../sync/write';
import type { Role } from '../types';

const CODE_RE = /^[A-Z2-9]{6}$/;

export default function Home() {
  const enter = useSessionStore((s) => s.enter);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoJoining, setAutoJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  // Pré-remplissage / auto-join via ?session=XXXXXX&role=gm|decker
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    const params = new URLSearchParams(window.location.search);
    const urlCode = (params.get('session') ?? '').toUpperCase();
    const urlRole = params.get('role');
    if (!CODE_RE.test(urlCode)) return;
    setCode(urlCode);
    if (urlRole === 'gm' || urlRole === 'decker') {
      setAutoJoining(true);
      void join(urlCode, urlRole).finally(() => setAutoJoining(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join(joinCode: string, role: Role) {
    setError(null);
    if (!CODE_RE.test(joinCode)) {
      setError('Code invalide : 6 caractères (lettres et chiffres).');
      return;
    }
    setBusy(true);
    try {
      if (!(await sessionExists(joinCode))) {
        setError(`Aucune session « ${joinCode} » trouvée.`);
        return;
      }
      enter(joinCode, role);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const newCode = await createSession(name.trim());
      setCreatedCode(newCode);
      setCode(newCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (autoJoining) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="pulse-slow glow-text tracking-[0.3em] text-neon-cyan">
          CONNEXION À LA SESSION…
        </p>
      </div>
    );
  }

  const activeCode = createdCode ?? (CODE_RE.test(code) ? code : null);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 overflow-y-auto p-6">
      <header className="text-center">
        <h1 className="glow-text text-3xl tracking-[0.25em] text-neon-cyan">
          DECKER CONSOLE
        </h1>
        <p className="mt-1 text-xs tracking-widest text-ink-dim uppercase">
          Shadowrun Anarchy — compagnon matriciel
        </p>
      </header>

      <div className="flex w-full max-w-2xl flex-col gap-4 sm:flex-row">
        {/* Créer */}
        <section className="flex-1 rounded border border-grid bg-panel p-4">
          <h2 className="panel-title">Créer une session</h2>
          <input
            className="field mb-3"
            placeholder="Nom de la partie (optionnel)"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-cyan w-full" disabled={busy} onClick={() => void create()}>
            Générer le code
          </button>
          {createdCode && (
            <p className="mt-3 text-center text-sm text-ink">
              Code :{' '}
              <span className="glow-text text-xl tracking-[0.3em] text-neon-green">
                {createdCode}
              </span>
            </p>
          )}
        </section>

        {/* Rejoindre */}
        <section className="flex-1 rounded border border-grid bg-panel p-4">
          <h2 className="panel-title">Rejoindre</h2>
          <input
            className="field mb-3 text-center text-lg tracking-[0.4em] uppercase"
            placeholder="CODE"
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
          />
          <div className="flex gap-2">
            <button
              className="btn btn-magenta flex-1 py-4 text-base"
              disabled={busy || !activeCode}
              onClick={() => void join(code, 'gm')}
            >
              MJ
            </button>
            <button
              className="btn btn-cyan flex-1 py-4 text-base"
              disabled={busy || !activeCode}
              onClick={() => void join(code, 'decker')}
            >
              DECKER
            </button>
          </div>
        </section>
      </div>

      {error && <p className="text-sm text-neon-red">{error}</p>}

      <p className="max-w-md text-center text-[11px] leading-5 text-ink-dim">
        Astuce : une fois en session, l'URL contient{' '}
        <code>?session=CODE&role=…</code> — mettez-la en favori pour revenir
        directement dans votre vue.
      </p>
    </div>
  );
}
