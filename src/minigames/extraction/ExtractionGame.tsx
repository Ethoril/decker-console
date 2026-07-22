import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExtractionParams, MiniGameProgress } from '../../types';
import type { MiniGameProps } from '../types';

const N = 1;
const E = 2;
const S = 4;
const W = 8;

function createMaze(size: number): number[] {
  const walls = Array<number>(size * size).fill(N | E | S | W);
  const visited = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const current = stack[stack.length - 1];
    const row = Math.floor(current / size);
    const col = current % size;
    const choices = [
      { next: current - size, wall: N, opposite: S, ok: row > 0 },
      { next: current + 1, wall: E, opposite: W, ok: col < size - 1 },
      { next: current + size, wall: S, opposite: N, ok: row < size - 1 },
      { next: current - 1, wall: W, opposite: E, ok: col > 0 },
    ].filter((choice) => choice.ok && !visited.has(choice.next));
    if (!choices.length) {
      stack.pop();
      continue;
    }
    const choice = choices[Math.floor(Math.random() * choices.length)];
    walls[current] &= ~choice.wall;
    walls[choice.next] &= ~choice.opposite;
    visited.add(choice.next);
    stack.push(choice.next);
  }
  return walls;
}

function wallBetween(from: number, to: number, size: number): number | null {
  if (to === from - size) return N;
  if (to === from + 1 && from % size < size - 1) return E;
  if (to === from + size) return S;
  if (to === from - 1 && from % size > 0) return W;
  return null;
}

export function ExtractionGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<ExtractionParams, MiniGameProgress>) {
  const maze = useMemo(() => createMaze(params.gridSize), [params.gridSize]);
  const [trail, setTrail] = useState<number[]>([]);
  const trailRef = useRef<number[]>([]);
  const [seconds, setSeconds] = useState(params.timeLimit);
  const [collision, setCollision] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const dragging = useRef(false);
  const finished = useRef(false);
  const exit = maze.length - 1;

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

  const replaceTrail = (next: number[]) => {
    trailRef.current = next;
    setTrail(next);
    onProgress({
      label: 'Chemin tracé',
      value: next.length,
      total: maze.length,
      detail: `${seconds}s restantes`,
    });
  };

  const enter = (index: number) => {
    if (!dragging.current || finished.current) return;
    const currentTrail = trailRef.current;
    const last = currentTrail[currentTrail.length - 1];
    if (index === last) return;
    const previousIndex = currentTrail.indexOf(index);
    if (previousIndex >= 0) {
      replaceTrail(currentTrail.slice(0, previousIndex + 1));
      return;
    }
    const wall = wallBetween(last, index, params.gridSize);
    if (wall === null || (maze[last] & wall) !== 0) {
      setCollision(true);
      replaceTrail([0]);
      window.setTimeout(() => setCollision(false), 220);
      return;
    }
    const next = [...currentTrail, index];
    replaceTrail(next);
    if (index === exit) {
      finished.current = true;
      dragging.current = false;
      onResult(true);
    }
  };

  const cellAt = (x: number, y: number): number | null => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-maze-cell]');
    return element ? Number(element.dataset.mazeCell) : null;
  };

  const currentHead = trail.length > 0 ? trail[trail.length - 1] : null;

  if (showTutorial) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 text-center p-4">
        <div className="border border-neon-cyan/50 bg-panel p-6 rounded-lg shadow-[0_0_20px_rgba(46,230,255,0.15)] flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">
            <span>Tutoriel</span>
            <span>Sécurité Matricielle</span>
          </div>
          
          <h2 className="glitch-text text-xl font-bold tracking-wider text-neon-cyan uppercase">
            Extraction d'Urgence
          </h2>
          
          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />
          
          <p className="text-xs text-ink leading-relaxed text-left">
            Votre Persona est traqué par la Glace noire. Fuyez par le port d'extraction du réseau !
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2.5">
            <p>
              ⚡ <strong className="text-neon-magenta">Action :</strong> Touchez et maintenez le clic sur l'entrée <span className="inline-flex items-center gap-1 rounded bg-neon-green/20 px-1.5 py-0.5 text-[10px] font-bold text-neon-green border border-neon-green/40 shadow-[0_0_8px_rgba(0,255,136,0.3)]">⚡ IN</span>, puis glissez pour tracer votre vecteur d'évasion.
            </p>
            <p>
              ⏱ <strong className="text-neon-cyan">Objectif :</strong> Atteignez la sortie <span className="inline-flex items-center gap-1 rounded bg-neon-red/20 px-1.5 py-0.5 text-[10px] font-bold text-neon-red border border-neon-red/40 shadow-[0_0_8px_rgba(255,0,85,0.3)]">🏃 OUT</span> avant la fin du temps imparti (<span className="text-neon-cyan font-bold">{params.timeLimit}s</span>).
            </p>
            <p>
              ⚠ <strong className="text-neon-red">Menace :</strong> Ne percutez pas les cloisons métalliques magenta ! Tout choc réinitialise immédiatement votre vecteur à zéro.
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer l'extraction
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3">
      {/* Top HUD */}
      <div className="flex flex-col gap-2 rounded-lg border border-grid bg-panel-2 p-3 shadow-md">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase border transition-all ${
              collision 
                ? 'border-neon-red bg-neon-red/25 text-neon-red animate-bounce shadow-[0_0_15px_rgba(255,0,85,0.5)]' 
                : 'border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan'
            }`}>
              <span className={`h-2 w-2 rounded-full ${collision ? 'bg-neon-red animate-ping' : 'bg-neon-cyan animate-pulse shadow-[0_0_6px_var(--color-neon-cyan)]'}`} />
              {collision ? '⚠ COLLISION — VECTEUR RÉINITIALISÉ' : `Vecteur : ${trail.length} pas`}
            </span>
          </div>

          <div className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold tracking-wide border ${
            seconds <= 6 
              ? 'border-neon-red bg-neon-red/20 text-neon-red animate-pulse shadow-[0_0_12px_rgba(255,0,85,0.4)]' 
              : 'border-neon-amber/50 bg-neon-amber/10 text-neon-amber shadow-[0_0_8px_rgba(255,180,0,0.2)]'
          }`}>
            <span>⏱️</span>
            <span>{seconds}s</span>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div
        className={`mx-auto grid min-h-0 flex-1 aspect-square max-h-[calc(100vh-160px)] w-full max-w-[calc(100vh-160px)] rounded-lg border bg-panel p-2 transition-shadow duration-200 shadow-[0_0_25px_rgba(0,0,0,0.6)] ${
          collision ? 'border-neon-red shadow-[0_0_30px_rgba(255,0,85,0.6)]' : 'border-grid'
        }`}
        style={{ gridTemplateColumns: `repeat(${params.gridSize}, minmax(0, 1fr))`, touchAction: 'none' }}
        onPointerDown={(event) => {
          const index = cellAt(event.clientX, event.clientY);
          if (index !== 0 || finished.current) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = true;
          replaceTrail([0]);
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return;
          const index = cellAt(event.clientX, event.clientY);
          if (index !== null) enter(index);
        }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {maze.map((walls, index) => {
          const active = trail.includes(index);
          const isHead = index === currentHead;
          const isStart = index === 0;
          const isExit = index === exit;

          return (
            <div
              key={index}
              data-maze-cell={index}
              className={`relative min-h-0 flex items-center justify-center transition-all duration-150 ${
                active ? 'bg-neon-cyan/20 shadow-[inset_0_0_10px_rgba(46,230,255,0.25)]' : 'bg-panel-2/90'
              }`}
              style={{
                borderTop: `${(walls & N) !== 0 ? 3 : 0}px solid rgba(255, 0, 128, 0.9)`,
                borderRight: `${(walls & E) !== 0 ? 3 : 0}px solid rgba(255, 0, 128, 0.9)`,
                borderBottom: `${(walls & S) !== 0 ? 3 : 0}px solid rgba(255, 0, 128, 0.9)`,
                borderLeft: `${(walls & W) !== 0 ? 3 : 0}px solid rgba(255, 0, 128, 0.9)`,
                boxShadow: (walls & (N | E | S | W)) ? '0 0 4px rgba(255, 0, 128, 0.15)' : undefined,
              }}
            >
              {/* Start Badge (IN) */}
              {isStart && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="flex items-center gap-0.5 rounded bg-panel-2/95 px-1 py-0.5 text-[9px] font-black tracking-wider text-neon-green border border-neon-green shadow-[0_0_10px_rgba(0,255,136,0.5)]">
                    <span>⚡</span>
                    <span>IN</span>
                  </div>
                </div>
              )}

              {/* Exit Badge (OUT) */}
              {isExit && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="flex items-center gap-0.5 rounded bg-panel-2/95 px-1 py-0.5 text-[9px] font-black tracking-wider text-neon-red border border-neon-red shadow-[0_0_10px_rgba(255,0,85,0.5)] animate-pulse">
                    <span>🏃</span>
                    <span>OUT</span>
                  </div>
                </div>
              )}

              {/* Active Path Dots */}
              {active && !isStart && !isExit && (
                <span 
                  className={`rounded-full transition-all duration-200 ${
                    isHead 
                      ? 'h-3.5 w-3.5 bg-neon-cyan shadow-[0_0_12px_var(--color-neon-cyan)] ring-2 ring-white/90 animate-pulse' 
                      : 'h-2 w-2 bg-neon-cyan/75 shadow-[0_0_6px_var(--color-neon-cyan)]'
                  }`} 
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-ink-dim">
        Tracez depuis <span className="text-neon-green font-bold">⚡ IN</span> jusqu'à la sortie <span className="text-neon-red font-bold">🏃 OUT</span> sans toucher les cloisons magenta.
      </p>
    </div>
  );
}

