import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProgress, SequenceParams } from '../../types';
import type { MiniGameProps } from '../types';

const TILE_COLORS = [
  { border: 'border-neon-cyan', bg: 'bg-neon-cyan/20', activeBg: 'bg-neon-cyan/60', shadow: 'shadow-[0_0_24px_var(--color-neon-cyan)]', text: 'text-neon-cyan', hex: '#2ee6ff' },
  { border: 'border-neon-magenta', bg: 'bg-neon-magenta/20', activeBg: 'bg-neon-magenta/60', shadow: 'shadow-[0_0_24px_var(--color-neon-magenta)]', text: 'text-neon-magenta', hex: '#ff0080' },
  { border: 'border-neon-green', bg: 'bg-neon-green/20', activeBg: 'bg-neon-green/60', shadow: 'shadow-[0_0_24px_var(--color-neon-green)]', text: 'text-neon-green', hex: '#00ff88' },
  { border: 'border-neon-amber', bg: 'bg-neon-amber/20', activeBg: 'bg-neon-amber/60', shadow: 'shadow-[0_0_24px_var(--color-neon-amber)]', text: 'text-neon-amber', hex: '#ffb400' },
  { border: 'border-blue-500', bg: 'bg-blue-500/20', activeBg: 'bg-blue-500/60', shadow: 'shadow-[0_0_24px_rgba(59,130,246,0.8)]', text: 'text-blue-400', hex: '#3b82f6' },
  { border: 'border-purple-500', bg: 'bg-purple-500/20', activeBg: 'bg-purple-500/60', shadow: 'shadow-[0_0_24px_rgba(168,85,247,0.8)]', text: 'text-purple-400', hex: '#a855f7' },
  { border: 'border-orange-500', bg: 'bg-orange-500/20', activeBg: 'bg-orange-500/60', shadow: 'shadow-[0_0_24px_rgba(249,115,22,0.8)]', text: 'text-orange-400', hex: '#f97316' },
  { border: 'border-pink-500', bg: 'bg-pink-500/20', activeBg: 'bg-pink-500/60', shadow: 'shadow-[0_0_24px_rgba(236,72,153,0.8)]', text: 'text-pink-400', hex: '#ec4899' },
  { border: 'border-lime-400', bg: 'bg-lime-400/20', activeBg: 'bg-lime-400/60', shadow: 'shadow-[0_0_24px_rgba(132,204,22,0.8)]', text: 'text-lime-400', hex: '#84cc16' },
  { border: 'border-teal-400', bg: 'bg-teal-400/20', activeBg: 'bg-teal-400/60', shadow: 'shadow-[0_0_24px_rgba(20,184,166,0.8)]', text: 'text-teal-400', hex: '#14b8a6' },
  { border: 'border-red-500', bg: 'bg-red-500/20', activeBg: 'bg-red-500/60', shadow: 'shadow-[0_0_24px_rgba(239,68,68,0.8)]', text: 'text-red-400', hex: '#ef4444' },
  { border: 'border-indigo-400', bg: 'bg-indigo-400/20', activeBg: 'bg-indigo-400/60', shadow: 'shadow-[0_0_24px_rgba(99,102,241,0.8)]', text: 'text-indigo-400', hex: '#6366f1' },
  { border: 'border-yellow-300', bg: 'bg-yellow-300/20', activeBg: 'bg-yellow-300/60', shadow: 'shadow-[0_0_24px_rgba(253,224,71,0.8)]', text: 'text-yellow-300', hex: '#fde047' },
  { border: 'border-cyan-300', bg: 'bg-cyan-300/20', activeBg: 'bg-cyan-300/60', shadow: 'shadow-[0_0_24px_rgba(103,232,249,0.8)]', text: 'text-cyan-300', hex: '#67e8f9' },
  { border: 'border-fuchsia-400', bg: 'bg-fuchsia-400/20', activeBg: 'bg-fuchsia-400/60', shadow: 'shadow-[0_0_24px_rgba(232,121,249,0.8)]', text: 'text-fuchsia-400', hex: '#e879f9' },
  { border: 'border-emerald-400', bg: 'bg-emerald-400/20', activeBg: 'bg-emerald-400/60', shadow: 'shadow-[0_0_24px_rgba(52,211,153,0.8)]', text: 'text-emerald-400', hex: '#34d399' },
];

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

  // Clears every pending demo/replay timer
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

  // Play demonstration sequence cleanly without flicker
  const playDemo = useCallback(() => {
    clearDemoTimers();
    setPhase('demo');
    setUserStep(0);
    let step = 0;

    const playNextStep = () => {
      if (step >= sequence.length) {
        clearDemoTimers();
        setActiveTile(null);
        setActiveStatus(null);
        setPhase('user');
        return;
      }

      // Briefly clear tile to ensure a clean pulse even if consecutive tiles are identical
      setActiveTile(null);
      setActiveStatus(null);

      demoTimeoutRef.current = window.setTimeout(() => {
        setActiveTile(sequence[step]);
        setActiveStatus('demo');

        demoTimeoutRef.current = window.setTimeout(() => {
          step++;
          playNextStep();
        }, params.displaySpeedMs * 0.75);
      }, 50);
    };

    playNextStep();
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
      }, 350);

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
              👁️ <strong className="text-neon-cyan">Phase 1 :</strong> Observez la séquence de pavés de couleurs émise par le système.
            </p>
            <p>
              🧠 <strong className="text-neon-magenta">Phase 2 :</strong> Reproduisez la séquence exacte en appuyant sur les pavés colorés dans le même ordre.
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
            {phase === 'demo' ? '👁️ OBSERVATION SÉQUENCE...' : `🧠 RÉPLICATION (${userStep}/${sequence.length})`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded border border-neon-red/40 bg-neon-red/10 px-2.5 py-1 text-xs font-bold text-neon-red">
          <span>Erreurs :</span>
          <span>{errors} / {params.maxErrors}</span>
        </div>
      </div>

      {/* Grid Container */}
      <div
        className="mx-auto grid min-h-0 flex-1 aspect-square max-h-[calc(100vh-170px)] w-full max-w-[calc(100vh-170px)] gap-2.5 rounded-lg border border-grid bg-panel p-3 shadow-[0_0_25px_rgba(0,0,0,0.5)]"
        style={{ gridTemplateColumns: `repeat(${params.gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalTiles }).map((_, index) => {
          const colorConfig = TILE_COLORS[index % TILE_COLORS.length];
          const isActive = activeTile === index;

          let dynamicStyle = `${colorConfig.border} ${colorConfig.bg} hover:border-white/60`;

          if (isActive) {
            if (activeStatus === 'demo') {
              dynamicStyle = `${colorConfig.border} ${colorConfig.activeBg} ${colorConfig.shadow} scale-95 border-2 border-white`;
            } else if (activeStatus === 'hit') {
              dynamicStyle = `border-neon-green bg-neon-green/60 shadow-[0_0_25px_var(--color-neon-green)] scale-95 border-2 border-white`;
            } else if (activeStatus === 'miss') {
              dynamicStyle = `border-neon-red bg-neon-red/70 shadow-[0_0_25px_var(--color-neon-red)] animate-shake border-2 border-white`;
            }
          }

          return (
            <button
              key={index}
              disabled={phase === 'demo'}
              className={`relative flex items-center justify-center rounded-xl border-2 transition-all duration-150 p-0 ${dynamicStyle} ${
                phase === 'user' ? 'cursor-pointer active:scale-90' : 'cursor-wait'
              }`}
              onClick={() => handleTileClick(index)}
            >
              <span className={`h-4 w-4 rounded-full transition-all ${
                isActive 
                  ? 'bg-white shadow-[0_0_12px_white] scale-125' 
                  : `${colorConfig.bg} border ${colorConfig.border}`
              }`} />
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-ink-dim">
        {phase === 'demo' 
          ? 'Mémorisez les couleurs et l’ordre des pavés...' 
          : 'Appuyez sur les pavés colorés dans le même ordre.'}
      </p>
    </div>
  );
}
