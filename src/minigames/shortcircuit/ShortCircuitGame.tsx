import { useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProgress, ShortCircuitParams } from '../../types';
import type { MiniGameProps } from '../types';

function toggleGridIndex(currentGrid: boolean[], index: number, gridSize: number): boolean[] {
  const next = [...currentGrid];
  const total = gridSize * gridSize;
  const r = Math.floor(index / gridSize);
  const c = index % gridSize;

  const targets = [
    index, // Cell itself
    r > 0 ? (r - 1) * gridSize + c : -1, // Top
    r < gridSize - 1 ? (r + 1) * gridSize + c : -1, // Bottom
    c > 0 ? r * gridSize + (c - 1) : -1, // Left
    c < gridSize - 1 ? r * gridSize + (c + 1) : -1, // Right
  ];

  targets.forEach((t) => {
    if (t >= 0 && t < total) {
      next[t] = !next[t];
    }
  });

  return next;
}

export function ShortCircuitGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<ShortCircuitParams, MiniGameProgress>) {
  const totalTiles = params.gridSize * params.gridSize;

  // Solvable initial grid generation (scrambled from all-off state)
  const initialGrid = useMemo(() => {
    let grid = new Array<boolean>(totalTiles).fill(false);

    // Apply scrambleMoves on random cells
    for (let i = 0; i < params.scrambleMoves; i++) {
      const randomIndex = Math.floor(Math.random() * totalTiles);
      grid = toggleGridIndex(grid, randomIndex, params.gridSize);
    }

    // Anti-immediate-win check: ensure at least 1 sensor is active
    let activeCount = grid.filter(Boolean).length;
    let guard = 0;
    while (activeCount === 0 && guard < 50) {
      const randomIndex = Math.floor(Math.random() * totalTiles);
      grid = toggleGridIndex(grid, randomIndex, params.gridSize);
      activeCount = grid.filter(Boolean).length;
      guard++;
    }

    return grid;
  }, [params.gridSize, params.scrambleMoves, totalTiles]);

  const [grid, setGrid] = useState<boolean[]>(initialGrid);
  const [seconds, setSeconds] = useState(params.timeLimit);
  const [showTutorial, setShowTutorial] = useState(true);

  const finished = useRef(false);
  const secondsRef = useRef(params.timeLimit);

  // Timer Countdown
  useEffect(() => {
    if (showTutorial) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        const next = value - 1;
        if (next <= 0 && !finished.current) {
          finished.current = true;
          onResult(false);
        }
        const clamped = Math.max(0, next);
        secondsRef.current = clamped;
        return clamped;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onResult, showTutorial]);

  const handleCellClick = (index: number) => {
    if (showTutorial || finished.current) return;

    const nextGrid = toggleGridIndex(grid, index, params.gridSize);
    const activeCount = nextGrid.filter(Boolean).length;
    const deactivatedCount = totalTiles - activeCount;

    setGrid(nextGrid);

    onProgress({
      label: 'Capteurs neutralisés',
      value: deactivatedCount,
      total: totalTiles,
      detail: `${activeCount} capteurs actifs`,
    });

    if (activeCount === 0 && !finished.current) {
      finished.current = true;
      window.setTimeout(() => onResult(true), 250);
    }
  };

  const activeSensors = grid.filter(Boolean).length;
  const progressPercent = Math.round(((totalTiles - activeSensors) / totalTiles) * 100);

  if (showTutorial) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 text-center p-4">
        <div className="border border-neon-cyan/50 bg-panel p-6 rounded-lg shadow-[0_0_20px_rgba(46,230,255,0.15)] flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">
            <span>Tutoriel</span>
            <span>Sécurité Matricielle</span>
          </div>

          <h2 className="glitch-text text-xl font-bold tracking-wider text-neon-cyan uppercase">
            Court-circuit
          </h2>

          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />

          <p className="text-xs text-ink leading-relaxed text-left">
            Neutralisez la grille de capteurs d'alarme. Toucher un capteur inverse son état et celui de ses 4 voisins orthogonaux.
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2.5">
            <p>
              🔴 <strong className="text-neon-red">Capteur actif :</strong> Case ambre/rouge sous tension.
            </p>
            <p>
              ⚡ <strong className="text-neon-cyan">Bascule :</strong> Toucher un capteur inverse l'état (<span className="text-neon-cyan font-bold">ON ↔ OFF</span>) de la case et de ses voisines (haut, bas, gauche, droite).
            </p>
            <p>
              ⏱ <strong className="text-neon-green">Objectif :</strong> Éteignez <span className="text-neon-green font-bold">tous</span> les capteurs avant la fin du temps imparti (<span className="text-neon-red font-bold">{params.timeLimit}s</span>).
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer la neutralisation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-3">
      {/* Top HUD */}
      <div className="flex flex-col gap-2 rounded-lg border border-grid bg-panel-2 p-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase border transition-all ${
              activeSensors === 0
                ? 'border-neon-green bg-neon-green/20 text-neon-green shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                : 'border-neon-red/40 bg-neon-red/15 text-neon-red'
            }`}>
              <span className={`h-2.5 w-2.5 rounded-full ${activeSensors === 0 ? 'bg-neon-green animate-ping' : 'bg-neon-red animate-pulse'}`} />
              Capteurs actifs : {activeSensors} / {totalTiles}
            </span>
          </div>

          {/* Enlarge Timer Display */}
          <div className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm sm:text-base font-black font-mono tracking-wider border-2 ${
            seconds <= 6
              ? 'border-neon-red bg-neon-red/25 text-neon-red animate-pulse shadow-[0_0_16px_rgba(255,0,85,0.6)]'
              : 'border-neon-amber/70 bg-neon-amber/15 text-neon-amber shadow-[0_0_10px_rgba(255,180,0,0.3)]'
          }`}>
            <span className="text-base">⏱️</span>
            <span>{seconds}s</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-panel border border-grid">
          <div
            className="h-full bg-gradient-to-r from-neon-blue via-neon-cyan to-neon-green transition-all duration-200 shadow-[0_0_8px_var(--color-neon-cyan)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Grid Container */}
      <div
        className="mx-auto grid min-h-0 flex-1 aspect-square max-h-[calc(100vh-170px)] w-full max-w-[calc(100vh-170px)] gap-2.5 rounded-lg border border-grid bg-panel p-3 shadow-[0_0_25px_rgba(0,0,0,0.6)]"
        style={{ gridTemplateColumns: `repeat(${params.gridSize}, minmax(0, 1fr))` }}
      >
        {grid.map((isOn, index) => (
          <button
            key={index}
            className={`relative flex items-center justify-center rounded-xl border-2 transition-all duration-150 cursor-pointer active:scale-95 select-none ${
              isOn
                ? 'border-neon-red bg-neon-red/30 shadow-[0_0_16px_rgba(255,0,85,0.5)]'
                : 'border-grid bg-panel-2 hover:border-neon-cyan/40 shadow-inner'
            }`}
            onClick={() => handleCellClick(index)}
          >
            <span className={`h-4 w-4 rounded-full transition-all ${
              isOn
                ? 'bg-neon-red shadow-[0_0_12px_var(--color-neon-red)] animate-pulse scale-110'
                : 'bg-ink-dim/20'
            }`} />
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-ink-dim">
        Appuyez sur un capteur pour le basculer (<span className="text-neon-red font-bold">ON</span> / <span className="text-ink-dim font-bold">OFF</span>) ainsi que ses 4 voisins.
      </p>
    </div>
  );
}
