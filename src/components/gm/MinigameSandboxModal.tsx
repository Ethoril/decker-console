import { useState, useMemo } from 'react';
import type {
  MiniGameKind,
  MiniGameProgress,
  InjectionParams,
  OverloadParams,
  DecryptionParams,
  ExtractionParams,
  SequenceParams,
  ShortCircuitParams,
} from '../../types';
import {
  MINI_GAME_LABELS,
  injectionParams,
  overloadParams,
  decryptionParams,
  extractionParams,
  sequenceParams,
  shortCircuitParams,
} from '../../game/minigames';
import { InjectionGame } from '../../minigames/injection/InjectionGame';
import { OverloadGame } from '../../minigames/overload/OverloadGame';
import { DecryptionGame } from '../../minigames/decryption/DecryptionGame';
import { ExtractionGame } from '../../minigames/extraction/ExtractionGame';
import { SequenceGame } from '../../minigames/sequence/SequenceGame';
import { ShortCircuitGame } from '../../minigames/shortcircuit/ShortCircuitGame';

interface MinigameSandboxModalProps {
  onClose: () => void;
}

type Screen = 'config' | 'running';

export function MinigameSandboxModal({ onClose }: MinigameSandboxModalProps) {
  const [screen, setScreen] = useState<Screen>('config');
  const [kind, setKind] = useState<MiniGameKind>('injection');
  const [successes, setSuccesses] = useState<number>(2); // Par défaut "Moyen" (2 succès)
  const [runId, setRunId] = useState<number>(1);
  const [progress, setProgress] = useState<MiniGameProgress | null>(null);
  const [result, setResult] = useState<{ won: boolean } | null>(null);
  const [simulatedDamage, setSimulatedDamage] = useState<number>(0);

  // Difficultés réelles mappées sur les succès
  const difficulties = [
    { label: 'Facile (4+ succès)', value: 4 },
    { label: 'Moyen (2-3 succès)', value: 2 },
    { label: 'Difficile (1 succès)', value: 1 },
    { label: 'Très Difficile (0 succès)', value: 0 },
  ];

  // Calcul dynamique des paramètres pour l'aperçu et le jeu
  const gameParams = useMemo(() => {
    switch (kind) {
      case 'injection':
        return injectionParams(successes);
      case 'overload':
        return overloadParams(successes);
      case 'decryption':
        return decryptionParams(successes);
      case 'extraction':
        return extractionParams(successes);
      case 'sequence':
        return sequenceParams(successes);
      case 'shortcircuit':
        return shortCircuitParams(successes);
    }
  }, [kind, successes]);

  const difficultyLabel = useMemo(() => {
    if (successes >= 4) return 'Facile';
    if (successes >= 2) return 'Moyen';
    if (successes === 1) return 'Difficile';
    return 'Très Difficile';
  }, [successes]);

  const handleStart = () => {
    setProgress(null);
    setResult(null);
    setSimulatedDamage(0);
    setScreen('running');
  };

  const handleRestart = () => {
    setProgress(null);
    setResult(null);
    setSimulatedDamage(0);
    setRunId((id) => id + 1);
  };

  const handleQuitGame = () => {
    setScreen('config');
    setProgress(null);
    setResult(null);
    setSimulatedDamage(0);
  };

  const handleProgress = (newProgress: MiniGameProgress) => {
    setProgress(newProgress);
  };

  const handleResult = (won: boolean) => {
    setResult({ won });
  };

  const handleMiss = () => {
    setSimulatedDamage((d) => d + 1);
  };

  // Clé unique pour forcer le démontage/remontage complet du jeu
  const gameKey = `${kind}-${successes}-${runId}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-abyss/80" />
      
      {screen === 'config' ? (
        <div
          className="relative z-10 flex max-h-full w-full max-w-lg flex-col gap-4 overflow-y-auto rounded border border-grid bg-panel p-5 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-grid pb-2">
            <h2 className="panel-title mb-0 text-neon-cyan flex items-center gap-2">
              <span>🎮 Bac à sable Mini-jeux</span>
            </h2>
            <button className="btn px-2 py-0.5 text-xs" onClick={onClose} aria-label="Fermer">
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Sélection du mini-jeu */}
            <label className="flex flex-col gap-1">
              <span className="text-[10px] tracking-wider text-ink-dim uppercase">Mini-jeu</span>
              <select
                className="field text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as MiniGameKind)}
              >
                {(Object.keys(MINI_GAME_LABELS) as MiniGameKind[]).map((gameKind) => (
                  <option key={gameKind} value={gameKind}>
                    {MINI_GAME_LABELS[gameKind]}
                  </option>
                ))}
              </select>
            </label>

            {/* Sélection de la difficulté */}
            <label className="flex flex-col gap-1">
              <span className="text-[10px] tracking-wider text-ink-dim uppercase">
                Difficulté (dépend des succès au jet)
              </span>
              <select
                className="field text-sm"
                value={successes}
                onChange={(e) => setSuccesses(Number(e.target.value))}
              >
                {difficulties.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Aperçu des paramètres */}
            <div className="rounded border border-grid bg-panel-2 p-3">
              <h3 className="text-[10px] font-bold text-neon-magenta uppercase tracking-wider mb-2">
                ⚙️ Aperçu des paramètres
              </h3>
              
              {kind === 'injection' && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Longueur</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as InjectionParams).sequenceLength}</span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Alphabet</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as InjectionParams).alphabetSize}</span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Essais max</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as InjectionParams).maxAttempts}</span>
                  </div>
                </div>
              )}

              {kind === 'overload' && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Largeur zone</span>
                    <span className="text-neon-cyan font-bold">
                      {Math.round((gameParams as OverloadParams).zoneWidth * 100)}%
                    </span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Vitesse init</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as OverloadParams).speed}x</span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Paliers</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as OverloadParams).requiredHits}</span>
                  </div>
                </div>
              )}

              {kind === 'decryption' && (
                <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Grille</span>
                    <span className="text-neon-cyan font-bold">
                      {(gameParams as DecryptionParams).gridSize} × {(gameParams as DecryptionParams).gridSize}
                    </span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Temps</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as DecryptionParams).timeLimit}s</span>
                  </div>
                </div>
              )}

              {kind === 'extraction' && (
                <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Labyrinthe</span>
                    <span className="text-neon-cyan font-bold">
                      {(gameParams as ExtractionParams).gridSize} × {(gameParams as ExtractionParams).gridSize}
                    </span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Temps</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as ExtractionParams).timeLimit}s</span>
                  </div>
                </div>
              )}

              {kind === 'sequence' && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Grille</span>
                    <span className="text-neon-cyan font-bold">
                      {(gameParams as SequenceParams).gridSize}×{(gameParams as SequenceParams).gridSize}
                    </span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Séquence</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as SequenceParams).sequenceLength}</span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Erreurs max</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as SequenceParams).maxErrors}</span>
                  </div>
                </div>
              )}

              {kind === 'shortcircuit' && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Grille</span>
                    <span className="text-neon-cyan font-bold">
                      {(gameParams as ShortCircuitParams).gridSize} × {(gameParams as ShortCircuitParams).gridSize}
                    </span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Bascules</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as ShortCircuitParams).scrambleMoves}</span>
                  </div>
                  <div className="border border-grid/50 p-2 rounded bg-abyss">
                    <span className="block text-ink-dim text-[8px] uppercase">Temps</span>
                    <span className="text-neon-cyan font-bold">{(gameParams as ShortCircuitParams).timeLimit}s</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 border-t border-grid pt-3">
            <button className="btn flex-1 text-xs py-2" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-cyan flex-1 text-xs py-2 font-bold" onClick={handleStart}>
              Démarrer le test
            </button>
          </div>
        </div>
      ) : (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-abyss"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sandbox Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-neon-magenta/40 bg-panel px-4 py-2">
            <div>
              <p className="glow-text text-sm tracking-[0.2em] text-neon-magenta uppercase font-bold">
                🛠️ TEST EN COURS : {MINI_GAME_LABELS[kind]}
              </p>
              <p className="text-[10px] text-ink-dim">
                Mode Bac à sable · Difficulté : {difficultyLabel} ({successes} succès)
              </p>
            </div>
            <div className="flex items-center gap-3">
              {progress && (
                <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono border border-grid px-2 py-0.5 rounded bg-panel-2 text-ink-dim">
                  <span>{progress.label} : </span>
                  <span className="text-neon-cyan font-bold">{progress.value}</span>
                  <span>/</span>
                  <span>{progress.total}</span>
                  {progress.detail && <span className="text-neon-amber"> ({progress.detail})</span>}
                </div>
              )}
              {kind === 'overload' && (
                <div className="text-[10px] font-mono border border-neon-red/30 px-2 py-0.5 rounded bg-neon-red/5 text-neon-red">
                  Dégâts simulés : {simulatedDamage}
                </div>
              )}
              <span className="pulse-slow text-xs text-neon-cyan font-bold bg-neon-cyan/5 border border-neon-cyan/20 px-2 py-0.5 rounded select-none">
                LOCAL
              </span>
              <button className="btn btn-red text-xs px-3 py-1 font-bold" onClick={handleQuitGame}>
                Quitter le test
              </button>
            </div>
          </header>

          {/* Sandbox Game Area */}
          <main className="min-h-0 flex-1 overflow-y-auto p-3 relative">
            {kind === 'injection' && (
              <InjectionGame
                key={gameKey}
                params={gameParams as InjectionParams}
                onProgress={handleProgress}
                onResult={handleResult}
              />
            )}
            
            {kind === 'overload' && (
              <OverloadGame
                key={gameKey}
                params={gameParams as OverloadParams}
                onProgress={handleProgress}
                onResult={handleResult}
                onMiss={handleMiss}
              />
            )}

            {kind === 'decryption' && (
              <DecryptionGame
                key={gameKey}
                params={gameParams as DecryptionParams}
                onProgress={handleProgress}
                onResult={handleResult}
              />
            )}

            {kind === 'extraction' && (
              <ExtractionGame
                key={gameKey}
                params={gameParams as ExtractionParams}
                onProgress={handleProgress}
                onResult={handleResult}
              />
            )}

            {kind === 'sequence' && (
              <SequenceGame
                key={gameKey}
                params={gameParams as SequenceParams}
                onProgress={handleProgress}
                onResult={handleResult}
              />
            )}

            {kind === 'shortcircuit' && (
              <ShortCircuitGame
                key={gameKey}
                params={gameParams as ShortCircuitParams}
                onProgress={handleProgress}
                onResult={handleResult}
              />
            )}

            {/* Sandbox Completion Overlay */}
            {result && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-abyss/85 p-4">
                <div
                  className={`w-full max-w-sm rounded border bg-panel p-5 text-center shadow-[0_0_40px_rgba(0,0,0,0.8)] ${
                    result.won ? 'border-neon-green' : 'border-neon-red'
                  }`}
                >
                  <p
                    className={`glow-text mb-2 text-xl font-bold tracking-wider ${
                      result.won ? 'text-neon-green' : 'text-neon-red'
                    }`}
                  >
                    {result.won ? 'SÉQUENCE RÉUSSIE' : 'SÉQUENCE REJETÉE'}
                  </p>
                  
                  <div className="mb-4 text-left text-xs space-y-1.5 rounded border border-grid bg-panel-2 p-3 font-mono text-ink-dim">
                    <p><strong className="text-ink">Jeu :</strong> {MINI_GAME_LABELS[kind]}</p>
                    <p><strong className="text-ink">Difficulté :</strong> {difficultyLabel} ({successes} succès)</p>
                    {progress && (
                      <p>
                        <strong className="text-ink">Progression finale :</strong> {progress.value}/{progress.total}
                      </p>
                    )}
                    {kind === 'overload' && (
                      <p>
                        <strong className="text-neon-red">Dégâts subis (simulés) :</strong> {simulatedDamage}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button className="btn flex-1 text-xs py-2" onClick={handleQuitGame}>
                      Retour
                    </button>
                    <button className="btn btn-cyan flex-1 text-xs py-2 font-bold" onClick={handleRestart}>
                      Recommencer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
