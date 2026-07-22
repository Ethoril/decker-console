import { useEffect, useMemo, useRef, useState } from 'react';
import type { GlyphParams, MiniGameProgress } from '../../types';
import type { MiniGameProps } from '../types';

type TileType = 'straight' | 'corner' | 't_shape' | 'cross';

interface TileState {
  id: number;
  row: number;
  col: number;
  type: TileType;
  rotation: number; // 0, 90, 180, 270
}

// Direction ports: [Top, Right, Bottom, Left]
const BASE_PORTS: Record<TileType, boolean[]> = {
  straight: [true, false, true, false],
  corner: [true, true, false, false],
  t_shape: [true, true, true, false],
  cross: [true, true, true, true],
};

function getRotatedPorts(type: TileType, rotation: number): boolean[] {
  const base = BASE_PORTS[type];
  const shift = (rotation / 90) % 4;
  // Shift right
  return [
    base[(4 - shift) % 4],
    base[(5 - shift) % 4],
    base[(6 - shift) % 4],
    base[(7 - shift) % 4],
  ];
}

export function GlyphGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<GlyphParams, MiniGameProgress>) {
  const totalTiles = params.gridSize * params.gridSize;

  // Generate solvable initial tiles
  const initialTiles = useMemo(() => {
    const types: TileType[] = ['straight', 'corner', 't_shape', 'cross'];
    const n = params.gridSize;
    const tiles: TileState[] = [];

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const id = r * n + c;
        const randomType = types[Math.floor(Math.random() * types.length)];
        const randomRot = Math.floor(Math.random() * 4) * 90;
        tiles.push({ id, row: r, col: c, type: randomType, rotation: randomRot });
      }
    }

    // Garantit qu'une solution existe : le joueur ne contrôle que la rotation,
    // jamais le type — donc on fixe le TYPE des dalles d'un chemin IN->OUT
    // (bord haut+droite OU bord gauche+bas, au hasard) à un type capable du
    // segment/coude requis. La rotation reste aléatoire : le puzzle est toujours
    // à résoudre, mais jamais insoluble (un « straight » ne peut faire de coude).
    const setType = (r: number, c: number, t: TileType) => { tiles[r * n + c].type = t; };
    if (Math.random() < 0.5) {
      for (let c = 1; c < n - 1; c++) setType(0, c, 'straight');     // ligne du haut
      if (n >= 2) setType(0, n - 1, 'corner');                        // coude haut-droit
      for (let r = 1; r < n - 1; r++) setType(r, n - 1, 'straight');  // colonne de droite
    } else {
      for (let r = 1; r < n - 1; r++) setType(r, 0, 'straight');      // colonne de gauche
      if (n >= 2) setType(n - 1, 0, 'corner');                        // coude bas-gauche
      for (let c = 1; c < n - 1; c++) setType(n - 1, c, 'straight');  // ligne du bas
    }

    // Entrée (IN) et sortie (OUT) : coudes pré-orientés couvrant les deux routes.
    tiles[0].type = 'corner';
    tiles[0].rotation = 90; // Droite + Bas
    tiles[totalTiles - 1].type = 'corner';
    tiles[totalTiles - 1].rotation = 270; // Haut + Gauche

    return tiles;
  }, [params.gridSize, totalTiles]);

  const [tiles, setTiles] = useState<TileState[]>(initialTiles);
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

  // BFS Power Propagation
  const poweredSet = useMemo(() => {
    const powered = new Set<number>();
    const queue: number[] = [0];
    powered.add(0);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentTile = tiles[currentId];
      if (!currentTile) continue;

      const currentPorts = getRotatedPorts(currentTile.type, currentTile.rotation);
      const { row, col } = currentTile;

      // Neighbors: Top (0), Right (1), Bottom (2), Left (3)
      const neighbors = [
        { r: row - 1, c: col, dir: 0, oppDir: 2 },
        { r: row, c: col + 1, dir: 1, oppDir: 3 },
        { r: row + 1, c: col, dir: 2, oppDir: 0 },
        { r: row, c: col - 1, dir: 3, oppDir: 1 },
      ];

      neighbors.forEach(({ r, c, dir, oppDir }) => {
        if (r >= 0 && r < params.gridSize && c >= 0 && c < params.gridSize) {
          const neighborId = r * params.gridSize + c;
          const neighborTile = tiles[neighborId];
          const neighborPorts = getRotatedPorts(neighborTile.type, neighborTile.rotation);

          if (currentPorts[dir] && neighborPorts[oppDir] && !powered.has(neighborId)) {
            powered.add(neighborId);
            queue.push(neighborId);
          }
        }
      });
    }

    return powered;
  }, [tiles, params.gridSize]);

  // Check win condition
  useEffect(() => {
    if (showTutorial || finished.current) return;

    const isConnectedToOut = poweredSet.has(totalTiles - 1);

    onProgress({
      label: 'Circuit alimenté',
      value: poweredSet.size,
      total: totalTiles,
      detail: `${poweredSet.size}/${totalTiles} dalles sous tension`,
    });

    if (isConnectedToOut && !finished.current) {
      finished.current = true;
      window.setTimeout(() => onResult(true), 300);
    }
  }, [poweredSet, totalTiles, onProgress, onResult, showTutorial]);

  const handleRotate = (id: number) => {
    if (finished.current) return;
    setTiles((prev) =>
      prev.map((t) => (t.id === id ? { ...t, rotation: (t.rotation + 90) % 360 } : t)),
    );
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
            Reconstitution de Glyphe
          </h2>

          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />

          <p className="text-xs text-ink leading-relaxed text-left">
            Faites pivoter les dalles de circuit pour relier le port d'entrée (⚡ IN) au port de sortie (💾 OUT).
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2.5">
            <p>
              🔄 <strong className="text-neon-cyan">Action :</strong> Appuyez sur n'importe quelle dalle pour la faire pivoter de 90°.
            </p>
            <p>
              ⚡ <strong className="text-neon-green">Alimentation :</strong> Les conduits connectés s'illuminent automatiquement en vert néon.
            </p>
            <p>
              ⏱ <strong className="text-neon-red">Objectif :</strong> Connectez le port <span className="text-neon-green font-bold">💾 OUT</span> avant la fin du temps imparti (<span className="text-neon-red font-bold">{params.timeLimit}s</span>).
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer la reconstitution
          </button>
        </div>
      </div>
    );
  }

  const isComplete = poweredSet.has(totalTiles - 1);
  const progressPercent = Math.round((poweredSet.size / totalTiles) * 100);

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-3">
      {/* Top HUD */}
      <div className="flex flex-col gap-2 rounded-lg border border-grid bg-panel-2 p-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase border transition-all ${
              isComplete
                ? 'border-neon-green bg-neon-green/20 text-neon-green shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                : 'border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan'
            }`}>
              <span className={`h-2.5 w-2.5 rounded-full ${isComplete ? 'bg-neon-green animate-ping' : 'bg-neon-cyan'}`} />
              {isComplete ? '⚡ FLUX OPTIQUE ÉTABLI' : `Circuit connecté : ${poweredSet.size}/${totalTiles}`}
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

      {/* Grid Area */}
      <div
        className="mx-auto grid min-h-0 flex-1 aspect-square max-h-[calc(100vh-170px)] w-full max-w-[calc(100vh-170px)] gap-2.5 rounded-lg border border-grid bg-panel p-3 shadow-[0_0_25px_rgba(0,0,0,0.6)]"
        style={{ gridTemplateColumns: `repeat(${params.gridSize}, minmax(0, 1fr))` }}
      >
        {tiles.map((tile) => {
          const isPowered = poweredSet.has(tile.id);
          const isInput = tile.id === 0;
          const isOutput = tile.id === totalTiles - 1;
          const ports = getRotatedPorts(tile.type, tile.rotation);

          return (
            <button
              key={tile.id}
              className={`relative flex items-center justify-center rounded-xl border-2 transition-all duration-150 cursor-pointer active:scale-90 select-none ${
                isPowered
                  ? 'border-neon-green bg-neon-green/15 shadow-[0_0_16px_rgba(0,255,136,0.4)]'
                  : 'border-grid bg-panel-2 hover:border-neon-cyan/50'
              }`}
              onClick={() => handleRotate(tile.id)}
            >
              {/* Badge IN / OUT */}
              {isInput && (
                <span className="absolute top-1 left-1 rounded bg-neon-cyan/20 px-1 py-0.5 text-[8px] font-bold text-neon-cyan border border-neon-cyan/40">
                  ⚡ IN
                </span>
              )}
              {isOutput && (
                <span className={`absolute bottom-1 right-1 rounded px-1 py-0.5 text-[8px] font-bold border ${
                  isPowered ? 'bg-neon-green/30 text-neon-green border-neon-green' : 'bg-neon-amber/20 text-neon-amber border-neon-amber/40'
                }`}>
                  💾 OUT
                </span>
              )}

              {/* Circuit SVG Lines */}
              <svg className="h-full w-full p-2" viewBox="0 0 100 100">
                {/* Center Node */}
                <circle
                  cx="50"
                  cy="50"
                  r="8"
                  fill={isPowered ? '#00ff88' : '#2ee6ff'}
                  className={isPowered ? 'shadow-[0_0_10px_#00ff88]' : 'opacity-60'}
                />

                {/* Ports: Top (0), Right (1), Bottom (2), Left (3) */}
                {ports[0] && (
                  <line
                    x1="50"
                    y1="50"
                    x2="50"
                    y2="0"
                    stroke={isPowered ? '#00ff88' : '#2ee6ff'}
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                )}
                {ports[1] && (
                  <line
                    x1="50"
                    y1="50"
                    x2="100"
                    y2="50"
                    stroke={isPowered ? '#00ff88' : '#2ee6ff'}
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                )}
                {ports[2] && (
                  <line
                    x1="50"
                    y1="50"
                    x2="50"
                    y2="100"
                    stroke={isPowered ? '#00ff88' : '#2ee6ff'}
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                )}
                {ports[3] && (
                  <line
                    x1="50"
                    y1="50"
                    x2="0"
                    y2="50"
                    stroke={isPowered ? '#00ff88' : '#2ee6ff'}
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-ink-dim">
        Appuyez sur les dalles pour les faire tourner et relier <span className="text-neon-cyan font-bold">⚡ IN</span> à <span className="text-neon-green font-bold">💾 OUT</span>.
      </p>
    </div>
  );
}
