import { useEffect, useMemo, useRef, useState } from 'react';
import type { DecryptionParams, MiniGameProgress } from '../../types';
import type { MiniGameProps } from '../types';

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DIRECTIONS = [
  { bit: N, opposite: S, dr: -1, dc: 0 },
  { bit: E, opposite: W, dr: 0, dc: 1 },
  { bit: S, opposite: N, dr: 1, dc: 0 },
  { bit: W, opposite: E, dr: 0, dc: -1 },
] as const;

function rotate(mask: number): number {
  return ((mask << 1) & 15) | ((mask >> 3) & 1);
}

function createPuzzle(size: number): { masks: number[]; entry: number; exit: number } {
  const solved = Array<number>(size * size).fill(0);
  let row = Math.floor(Math.random() * size);
  const entry = row * size;
  solved[entry] |= W;

  for (let col = 0; col < size - 1; col += 1) {
    const nextRow = Math.max(0, Math.min(size - 1, row + Math.floor(Math.random() * 3) - 1));
    while (row !== nextRow) {
      const step = nextRow > row ? 1 : -1;
      const here = row * size + col;
      const there = (row + step) * size + col;
      solved[here] |= step > 0 ? S : N;
      solved[there] |= step > 0 ? N : S;
      row += step;
    }
    const here = row * size + col;
    const there = row * size + col + 1;
    solved[here] |= E;
    solved[there] |= W;
  }
  const exit = row * size + size - 1;
  solved[exit] |= E;

  const noise = [N | S, E | W, N | E, E | S, S | W, W | N, N | E | S];
  const masks = solved.map((mask) => {
    let value = mask || noise[Math.floor(Math.random() * noise.length)];
    const turns = Math.floor(Math.random() * 4);
    for (let i = 0; i < turns; i += 1) value = rotate(value);
    return value;
  });
  return { masks, entry, exit };
}

function connectedCells(masks: number[], size: number, entry: number): Set<number> {
  if ((masks[entry] & W) === 0) return new Set();
  const seen = new Set([entry]);
  const queue = [entry];
  while (queue.length) {
    const index = queue.shift()!;
    const row = Math.floor(index / size);
    const col = index % size;
    for (const direction of DIRECTIONS) {
      if ((masks[index] & direction.bit) === 0) continue;
      const nr = row + direction.dr;
      const nc = col + direction.dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      const next = nr * size + nc;
      if ((masks[next] & direction.opposite) === 0 || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

export function DecryptionGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<DecryptionParams, MiniGameProgress>) {
  const puzzle = useMemo(() => createPuzzle(params.gridSize), [params.gridSize]);
  const [tiles, setTiles] = useState(puzzle.masks);
  const [seconds, setSeconds] = useState(params.timeLimit);
  const [showTutorial, setShowTutorial] = useState(true);
  const finished = useRef(false);
  const connected = connectedCells(tiles, params.gridSize, puzzle.entry);

  useEffect(() => {
    if (showTutorial) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        const next = value - 1;
        if (next <= 0 && !finished.current) {
          finished.current = true;
          onResult(false);
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onResult, showTutorial]);

  const turn = (index: number) => {
    if (finished.current) return;
    setTiles((current) => {
      const next = [...current];
      next[index] = rotate(next[index]);
      const powered = connectedCells(next, params.gridSize, puzzle.entry);
      const won = powered.has(puzzle.exit) && (next[puzzle.exit] & E) !== 0;
      onProgress({
        label: 'Segments alimentés',
        value: powered.size,
        total: next.length,
        detail: `${seconds}s restantes`,
      });
      if (won) {
        finished.current = true;
        window.setTimeout(() => onResult(true), 120);
      }
      return next;
    });
  };

  const percentConnected = Math.round((connected.size / tiles.length) * 100);

  if (showTutorial) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 text-center p-4">
        <div className="border border-neon-cyan/50 bg-panel p-6 rounded-lg shadow-[0_0_20px_rgba(46,230,255,0.15)] flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">
            <span>Tutoriel</span>
            <span>Sécurité Matricielle</span>
          </div>
          
          <h2 className="glitch-text text-xl font-bold tracking-wider text-neon-cyan uppercase">
            Décryptage de Fichiers
          </h2>
          
          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />
          
          <p className="text-xs text-ink leading-relaxed text-left">
            Le fichier recherché (Paydata) est protégé par un verrouillage de flux de circuit fragmenté.
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2.5">
            <p>
              ⚡ <strong className="text-neon-magenta">Action :</strong> Touchez ou cliquez sur les segments de circuit pour les faire pivoter.
            </p>
            <p>
              ⏱ <strong className="text-neon-cyan">Objectif :</strong> Reliez l'entrée <span className="inline-flex items-center gap-1 rounded bg-neon-green/20 px-1.5 py-0.5 text-[10px] font-bold text-neon-green border border-neon-green/40 shadow-[0_0_8px_rgba(0,255,136,0.3)]">⚡ IN</span> à la sortie <span className="inline-flex items-center gap-1 rounded bg-neon-magenta/20 px-1.5 py-0.5 text-[10px] font-bold text-neon-magenta border border-neon-magenta/40 shadow-[0_0_8px_rgba(255,0,128,0.3)]">💾 OUT</span> pour alimenter et décrypter le circuit complet.
            </p>
            <p>
              ⚠ <strong className="text-neon-red">Menace :</strong> Vous devez terminer la connexion avant la fin du chronomètre (<span className="text-neon-red font-bold">{params.timeLimit}s</span> sur grille {params.gridSize}×{params.gridSize}).
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer le décryptage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-3">
      {/* Top HUD */}
      <div className="flex flex-col gap-2 rounded-lg border border-grid bg-panel-2 p-3 shadow-md">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-neon-cyan/15 px-2 py-0.5 text-[11px] font-semibold text-neon-cyan border border-neon-cyan/30">
              <span className="h-2 w-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_6px_var(--color-neon-cyan)]" />
              {connected.size} / {tiles.length} nœuds
            </span>
            <span className="text-[10px] tracking-wider text-ink-dim uppercase">
              ({percentConnected}%)
            </span>
          </div>

          {/* Enlarge Timer Display */}
          <div className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm sm:text-base font-black font-mono tracking-wider border-2 ${
            seconds <= 8 
              ? 'border-neon-red bg-neon-red/25 text-neon-red animate-pulse shadow-[0_0_16px_rgba(255,0,85,0.6)]' 
              : 'border-neon-amber/70 bg-neon-amber/15 text-neon-amber shadow-[0_0_10px_rgba(255,180,0,0.3)]'
          }`}>
            <span className="text-base">⏱️</span>
            <span>{seconds}s</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel border border-grid">
          <div 
            className="h-full bg-gradient-to-r from-neon-blue via-neon-cyan to-neon-green transition-all duration-300 shadow-[0_0_8px_var(--color-neon-cyan)]"
            style={{ width: `${percentConnected}%` }}
          />
        </div>
      </div>

      {/* Grid Container */}
      <div
        className="mx-auto grid min-h-0 flex-1 aspect-square max-h-[calc(100vh-170px)] w-full max-w-[calc(100vh-170px)] gap-1.5 rounded-lg border border-grid bg-panel p-2.5 shadow-[0_0_25px_rgba(0,0,0,0.5)]"
        style={{ gridTemplateColumns: `repeat(${params.gridSize}, minmax(0, 1fr))` }}
      >
        {tiles.map((mask, index) => {
          const powered = connected.has(index);
          const isEntry = index === puzzle.entry;
          const isExit = index === puzzle.exit;

          return (
            <button
              key={index}
              className={`relative min-h-0 overflow-hidden rounded-md border transition-all duration-150 active:scale-95 cursor-pointer select-none p-0 ${
                powered 
                  ? 'border-neon-cyan/70 bg-neon-cyan/15 shadow-[0_0_12px_rgba(46,230,255,0.25)]' 
                  : 'border-grid/80 bg-panel-2 hover:border-neon-cyan/40 hover:bg-panel-2/80'
              }`}
              aria-label={`Tourner le segment ${index + 1}`}
              onClick={() => turn(index)}
            >
              {/* Lines */}
              {(mask & N) !== 0 && (
                <span 
                  className={`absolute left-1/2 top-0 h-1/2 -translate-x-1/2 transition-colors duration-200 ${
                    powered 
                      ? 'w-1.5 bg-neon-cyan shadow-[0_0_8px_var(--color-neon-cyan)]' 
                      : 'w-1 bg-ink-dim/40'
                  }`} 
                />
              )}
              {(mask & E) !== 0 && (
                <span 
                  className={`absolute left-1/2 top-1/2 w-1/2 -translate-y-1/2 transition-colors duration-200 ${
                    powered 
                      ? 'h-1.5 bg-neon-cyan shadow-[0_0_8px_var(--color-neon-cyan)]' 
                      : 'h-1 bg-ink-dim/40'
                  }`} 
                />
              )}
              {(mask & S) !== 0 && (
                <span 
                  className={`absolute bottom-0 left-1/2 h-1/2 -translate-x-1/2 transition-colors duration-200 ${
                    powered 
                      ? 'w-1.5 bg-neon-cyan shadow-[0_0_8px_var(--color-neon-cyan)]' 
                      : 'w-1 bg-ink-dim/40'
                  }`} 
                />
              )}
              {(mask & W) !== 0 && (
                <span 
                  className={`absolute left-0 top-1/2 w-1/2 -translate-y-1/2 transition-colors duration-200 ${
                    powered 
                      ? 'h-1.5 bg-neon-cyan shadow-[0_0_8px_var(--color-neon-cyan)]' 
                      : 'h-1 bg-ink-dim/40'
                  }`} 
                />
              )}

              {/* Center Junction Node */}
              <span 
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ${
                  powered 
                    ? 'h-3 w-3 bg-neon-cyan shadow-[0_0_10px_var(--color-neon-cyan)]' 
                    : 'h-2 w-2 bg-ink-dim/50'
                }`} 
              />

              {/* Entry Node Badge (IN) */}
              {isEntry && (
                <div className="absolute left-0.5 top-0.5 z-10 flex items-center gap-0.5 rounded bg-panel-2/90 px-1 py-0.5 text-[9px] font-extrabold tracking-wider text-neon-green border border-neon-green/60 shadow-[0_0_8px_rgba(0,255,136,0.4)] backdrop-blur-xs">
                  <span>⚡</span>
                  <span>IN</span>
                </div>
              )}

              {/* Exit Node Badge (OUT) */}
              {isExit && (
                <div className="absolute bottom-0.5 right-0.5 z-10 flex items-center gap-0.5 rounded bg-panel-2/90 px-1 py-0.5 text-[9px] font-extrabold tracking-wider text-neon-magenta border border-neon-magenta/60 shadow-[0_0_8px_rgba(255,0,128,0.4)] backdrop-blur-xs">
                  <span>💾</span>
                  <span>OUT</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-ink-dim">
        Pivotez les segments de circuit pour relier la source <span className="text-neon-green font-bold">⚡ IN</span> au serveur <span className="text-neon-magenta font-bold">💾 OUT</span>.
      </p>
    </div>
  );
}

