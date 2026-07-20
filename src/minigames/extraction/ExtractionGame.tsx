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
      window.setTimeout(() => setCollision(false), 180);
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
            Votre Persona est piégé ou vous devez fuir en urgence par les ports de sortie réseau.
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2">
            <p>
              ⚡ <strong className="text-neon-magenta">Action :</strong> Touchez et maintenez le clic sur l'entrée <span className="text-neon-green font-bold">IN</span>, puis glissez pour tracer votre chemin.
            </p>
            <p>
              ⏱ <strong className="text-neon-cyan">Objectif :</strong> Atteignez la sortie <span className="text-neon-red font-bold">OUT</span> avant la fin du temps imparti (<span className="text-neon-cyan font-bold">{params.timeLimit}s</span>).
            </p>
            <p>
              ⚠ <strong className="text-neon-red">Menace :</strong> Ne touchez pas les cloisons magenta ! Tout choc réinitialise votre trace à zéro.
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
      <div className="flex items-center justify-between text-xs">
        <span className={collision ? 'glow-text text-neon-red' : 'text-neon-cyan'}>
          {collision ? 'COLLISION — TRACE RÉINITIALISÉE' : 'Maintenez et tracez depuis IN'}
        </span>
        <span className={seconds <= 6 ? 'pulse-alert text-neon-red' : 'text-neon-amber'}>{seconds}s</span>
      </div>
      <div
        className={`mx-auto grid min-h-0 flex-1 aspect-square max-h-[calc(100vh-145px)] w-full max-w-[calc(100vh-145px)] bg-panel p-1 ${collision ? 'shadow-[0_0_24px_var(--color-neon-red)]' : ''}`}
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
          return (
            <div
              key={index}
              data-maze-cell={index}
              className={`relative min-h-0 ${active ? 'bg-neon-cyan/30' : 'bg-panel-2'}`}
              style={{
                borderTop: `${(walls & N) !== 0 ? 2 : 0}px solid var(--color-neon-magenta)`,
                borderRight: `${(walls & E) !== 0 ? 2 : 0}px solid var(--color-neon-magenta)`,
                borderBottom: `${(walls & S) !== 0 ? 2 : 0}px solid var(--color-neon-magenta)`,
                borderLeft: `${(walls & W) !== 0 ? 2 : 0}px solid var(--color-neon-magenta)`,
              }}
            >
              {index === 0 && <span className="absolute inset-0 flex items-center justify-center text-[8px] text-neon-green">IN</span>}
              {index === exit && <span className="absolute inset-0 flex items-center justify-center text-[8px] text-neon-red">OUT</span>}
              {active && index !== 0 && index !== exit && <span className="absolute inset-1/3 rounded-full bg-neon-cyan" />}
            </div>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-ink-dim">
        Ne touchez pas les cloisons magenta. Vous pouvez revenir sur votre trace pour reculer.
      </p>
    </div>
  );
}
