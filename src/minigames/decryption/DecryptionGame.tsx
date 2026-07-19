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
  const finished = useRef(false);
  const connected = connectedCells(tiles, params.gridSize, puzzle.entry);

  useEffect(() => {
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
  }, [onResult]);

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

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neon-cyan">Circuit alimenté : {connected.size}/{tiles.length}</span>
        <span className={seconds <= 8 ? 'pulse-alert text-neon-red' : 'text-neon-amber'}>
          {seconds}s
        </span>
      </div>
      <div
        className="mx-auto grid min-h-0 flex-1 aspect-square max-h-[calc(100vh-150px)] w-full max-w-[calc(100vh-150px)] gap-1 rounded border border-grid bg-panel p-2"
        style={{ gridTemplateColumns: `repeat(${params.gridSize}, minmax(0, 1fr))` }}
      >
        {tiles.map((mask, index) => {
          const powered = connected.has(index);
          return (
            <button
              key={index}
              className={`relative min-h-0 overflow-hidden rounded border p-0 ${
                powered ? 'border-neon-cyan/50 bg-neon-cyan/10' : 'border-grid bg-panel-2'
              }`}
              aria-label={`Tourner le segment ${index + 1}`}
              onClick={() => turn(index)}
            >
              <span className={`absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${powered ? 'bg-neon-cyan' : 'bg-ink-dim'}`} />
              {(mask & N) !== 0 && <span className={`absolute left-1/2 top-0 h-1/2 w-1 -translate-x-1/2 ${powered ? 'bg-neon-cyan' : 'bg-ink-dim'}`} />}
              {(mask & E) !== 0 && <span className={`absolute left-1/2 top-1/2 h-1 w-1/2 -translate-y-1/2 ${powered ? 'bg-neon-cyan' : 'bg-ink-dim'}`} />}
              {(mask & S) !== 0 && <span className={`absolute bottom-0 left-1/2 h-1/2 w-1 -translate-x-1/2 ${powered ? 'bg-neon-cyan' : 'bg-ink-dim'}`} />}
              {(mask & W) !== 0 && <span className={`absolute left-0 top-1/2 h-1 w-1/2 -translate-y-1/2 ${powered ? 'bg-neon-cyan' : 'bg-ink-dim'}`} />}
              {index === puzzle.entry && <span className="absolute left-0 top-0 text-[8px] text-neon-green">IN</span>}
              {index === puzzle.exit && <span className="absolute bottom-0 right-0 text-[8px] text-neon-magenta">OUT</span>}
            </button>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-ink-dim">
        Touchez les segments pour relier IN à OUT avant la fin du chrono.
      </p>
    </div>
  );
}
