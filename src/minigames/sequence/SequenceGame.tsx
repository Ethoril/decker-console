import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProgress, SequenceParams } from '../../types';
import type { MiniGameProps } from '../types';

export function SequenceGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<SequenceParams, MiniGameProgress>) {
  const totalTiles = params.gridSize * params.gridSize;

  // Generate random sequence of tile indices
  const sequence = useMemo(() => {
    const seq: number[] = [];
    for (let i = 0; i < params.sequenceLength; i++) {
      seq.push(Math.floor(Math.random() * totalTiles));
    }
    return seq;
  }, [params.sequenceLength, totalTiles]);

  const [phase, setPhase] = useState<'demo' | 'user'>('demo');
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [activeStatus, setActiveStatus] = useState<'demo' | 'hit' | 'miss' | null>(null);
  const [userStep, setUserStep] = useState(0);
  const [errors, setErrors] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);

  const finished = useRef(false);
  const demoIntervalRef = useRef<number | null>(null);
  const demoTimeoutRef = useRef<number | null>(null);
  const replayTimeoutRef = useRef<number | null>(null);

  // Clears every pending demo/replay timer so nothing fires after unmount or replay.
  const clearDemoTimers = useCallback(() => {
    if (demoIntervalRef.current !== null) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    if (demoTimeoutRef.current !== null) {
      window.clearTimeout(demoTimeoutRef.current);
      demoTimeoutRef.current = null;
    }
    if (replayTimeoutRef.current !== null) {
      window.clearTimeout(replayTimeoutRef.current);
      replayTimeoutRef.current = null;
    }
  }, []);

  // Play demonstration sequence
  const playDemo = useCallback(() => {
    clearDemoTimers();
    setPhase('demo');
    setUserStep(0);
    let step = 0;

    demoIntervalRef.current = window.setInterval(() => {
      if (step >= sequence.length) {
        clearDemoTimers();
        setActiveTile(null);
        setActiveStatus(null);
        setPhase('user');
        return;
      }

      setActiveTile(sequence[step]);
      setActiveStatus('demo');
      step++;

      demoTimeoutRef.current = window.setTimeout(() => {
        setActiveTile(null);
        setActiveStatus(null);
      }, params.displaySpeedMs * 0.7);
    }, params.displaySpeedMs);
  }, [sequence, params.displaySpeedMs, clearDemoTimers]);

  useEffect(() => {
    if (showTutorial) return;
    playDemo();
    return clearDemoTimers;
  }, [playDemo, showTutorial, clearDemoTimers]);

  const handleTileClick = (index: number) => {
    if (phase !== 'user' || finished.current) return;

    const expected = sequence[userStep];

    if (index === expected) {
      // Correct tile
      setActiveTile(index);
      setActiveStatus('hit');
      window.setTimeout(() => {
        setActiveTile(null);
        setActiveStatus(null);
      }, 200);

      const nextStep = userStep + 1;
      setUserStep(nextStep);

      onProgress({
        label: 'Séquence mémorisée',
        value: nextStep,
        total: sequence.length,
        detail: `${nextStep}/${sequence.length} étapes répliquées`,
      });

      if (nextStep >= sequence.length) {
        finished.current = true;
        window.setTimeout(() => onResult(true), 250);
      }
    } else {
      // Wrong tile — freeze input immediately so panic-clicks can't stack extra errors
      const nextErrors = errors + 1;
      setErrors(nextErrors);
      setPhase('demo');
      setActiveTile(index);
      setActiveStatus('miss');

      window.setTimeout(() => {
        setActiveTile(null);
        setActiveStatus(null);
      }, 300);

      if (nextErrors > params.maxErrors) {
        finished.current = true;
        window.setTimeout(() => onResult(false), 350);
      } else {
        // Replay demonstration after brief delay
        replayTimeoutRef.current = window.setTimeout(() => {
          playDemo();
        }, 600);
      }
    }
  };

  if (showTutorial) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 text-center p-4">
        <div className="border border-neon-cyan/50 bg-panel p-6 rounded-lg shadow-[0_0_20px_rgba(46,230,255,0.15)] flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">
            <span>Tutoriel</span>
            <span>Sécurité Matricielle</span>
          </div>

          <h2 className="glitch-text text-xl font-bold tracking-wider text-neon-cyan uppercase">
            Matrice de Séquençage
          </h2>

          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />

          <p className="text-xs text-ink leading-relaxed text-left">
            Infiltrez les registres de mémoire en reproduisant la séquence de clés dynamiques.
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2.5">
            <p>
              👁️ <strong className="text-neon-cyan">Phase 1 :</strong> Observez la séquence lumineuse émise par le système.
            </p>
            <p>
              🧠 <strong className="text-neon-magenta">Phase 2 :</strong> Reproduisez la séquence exacte en cliquant sur les pavés dans le même ordre.
            </p>
            <p>
              ⚠ <strong className="text-neon-red">Menace :</strong> Répliquez <span className="text-neon-green font-bold">{params.sequenceLength}</span> pavés ({params.maxErrors} erreur(s) max).
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer le séquençage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-4">
      {/* Top HUD */}
      <div className="flex items-center justify-between rounded-lg border border-grid bg-panel-2 p-3 text-xs shadow-md">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold uppercase border transition-all ${
            phase === 'demo'
              ? 'border-neon-amber/50 bg-neon-amber/15 text-neon-amber animate-pulse'
              : 'border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan'
          }`}>
            <span className={`h-2 w-2 rounded-full ${phase === 'demo' ? 'bg-neon-amber animate-ping' : 'bg-neon-cyan'}`} />
            {phase === 'demo' ? '👁️ OBSERVATION...' : `🧠 RÉPLICATION (${userStep}/${sequence.length})`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded border border-neon-red/40 bg-neon-red/10 px-2.5 py-1 text-xs font-bold text-neon-red">
          <span>Erreurs :</span>
          <span>{errors} / {params.maxErrors}</span>
        </div>
      </div>

      {/* Grid Container */}
      <div
        className="mx-auto grid min-h-0 flex-1 aspect-square max-h-[calc(100vh-170px)] w-full max-w-[calc(100vh-170px)] gap-2 rounded-lg border border-grid bg-panel p-3 shadow-[0_0_25px_rgba(0,0,0,0.5)]"
        style={{ gridTemplateColumns: `repeat(${params.gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalTiles }).map((_, index) => {
          const isActive = activeTile === index;
          let tileStyle = 'border-grid/80 bg-panel-2 hover:border-neon-cyan/40';

          if (isActive) {
            if (activeStatus === 'demo') {
              tileStyle = 'border-neon-cyan bg-neon-cyan/40 shadow-[0_0_20px_var(--color-neon-cyan)] scale-98';
            } else if (activeStatus === 'hit') {
              tileStyle = 'border-neon-green bg-neon-green/50 shadow-[0_0_20px_var(--color-neon-green)] scale-95';
            } else if (activeStatus === 'miss') {
              tileStyle = 'border-neon-red bg-neon-red/50 shadow-[0_0_20px_var(--color-neon-red)] animate-shake';
            }
          }

          return (
            <button
              key={index}
              disabled={phase === 'demo'}
              className={`relative flex items-center justify-center rounded-lg border transition-all duration-150 p-0 ${tileStyle} ${
                phase === 'user' ? 'cursor-pointer active:scale-95' : 'cursor-wait'
              }`}
              onClick={() => handleTileClick(index)}
            >
              <span className={`h-3 w-3 rounded-full transition-all ${
                isActive 
                  ? 'bg-white shadow-[0_0_10px_white]' 
                  : 'bg-ink-dim/30'
              }`} />
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-ink-dim">
        {phase === 'demo' 
          ? 'Mémorisez l’ordre d’illumination des pavés...' 
          : 'Cliquez sur les pavés dans le même ordre.'}
      </p>
    </div>
  );
}
