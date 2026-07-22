import { useEffect, useRef, useState } from 'react';
import type { MiniGameProgress, SiphonParams } from '../../types';
import type { MiniGameProps } from '../types';

interface Packet {
  id: number;
  col: number; // 0 to columns-1
  y: number; // 0 to 100 (%)
  type: 'data' | 'bonus' | 'ice';
}

export function SiphonGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<SiphonParams, MiniGameProgress>) {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [collected, setCollected] = useState(0);
  const [seconds, setSeconds] = useState(params.timeLimit);
  const [flash, setFlash] = useState<'hit' | 'ice' | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);

  const finished = useRef(false);
  const packetsRef = useRef<Packet[]>([]);
  const collectedRef = useRef(0);
  const nextId = useRef(1);
  const spawnTimer = useRef(0);

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
        return Math.max(0, next);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onResult, showTutorial]);

  // Main Game Loop (Packet movement & Spawning)
  useEffect(() => {
    if (showTutorial) return;
    let frame = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Spawn packets
      spawnTimer.current += delta;
      if (spawnTimer.current >= 0.65) {
        spawnTimer.current = 0;
        const col = Math.floor(Math.random() * params.columns);
        const roll = Math.random();
        const type: 'data' | 'bonus' | 'ice' = roll < 0.6 ? 'data' : roll < 0.8 ? 'bonus' : 'ice';

        const newPacket: Packet = {
          id: nextId.current++,
          col,
          y: -10, // Start slightly above top
          type,
        };
        packetsRef.current.push(newPacket);
      }

      // Move packets downward
      const speedPercentPerSec = (params.fallSpeed / 300) * 100;
      const nextPackets = packetsRef.current
        .map((p) => ({ ...p, y: p.y + speedPercentPerSec * delta }))
        .filter((p) => p.y <= 100); // remove only when fully reaching the bottom edge

      packetsRef.current = nextPackets;
      setPackets(nextPackets);

      if (!finished.current) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [params, showTutorial]);

  const handlePacketClick = (id: number, type: 'data' | 'bonus' | 'ice') => {
    if (finished.current) return;

    // Remove packet from ref & state
    packetsRef.current = packetsRef.current.filter((p) => p.id !== id);
    setPackets(packetsRef.current);

    if (type === 'ice') {
      setFlash('ice');
      window.setTimeout(() => setFlash(null), 250);
      const next = Math.max(0, collectedRef.current - 1);
      collectedRef.current = next;
      setCollected(next);
    } else {
      setFlash('hit');
      window.setTimeout(() => setFlash(null), 180);
      const points = type === 'bonus' ? 2 : 1;
      const next = collectedRef.current + points;
      collectedRef.current = next;
      setCollected(next);

      onProgress({
        label: 'Paydata siphonné',
        value: next,
        total: params.requiredData,
        detail: `${next}/${params.requiredData} paquets siphonnés`,
      });

      if (next >= params.requiredData && !finished.current) {
        finished.current = true;
        window.setTimeout(() => onResult(true), 200);
      }
    }
  };

  const progressPercent = Math.min(100, Math.round((collected / params.requiredData) * 100));

  if (showTutorial) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 text-center p-4">
        <div className="border border-neon-cyan/50 bg-panel p-6 rounded-lg shadow-[0_0_20px_rgba(46,230,255,0.15)] flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">
            <span>Tutoriel</span>
            <span>Sécurité Matricielle</span>
          </div>

          <h2 className="glitch-text text-xl font-bold tracking-wider text-neon-cyan uppercase">
            Siphon de Flux
          </h2>

          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />

          <p className="text-xs text-ink leading-relaxed text-left">
            Interceptez les paquets de données Paydata qui défilent dans les tuyaux du réseau.
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2.5">
            <p>
              💾 <strong className="text-neon-cyan">Action :</strong> Touchez ou cliquez sur les paquets <span className="text-neon-green font-bold">DATA (💾)</span> et <span className="text-neon-amber font-bold font-semibold">BONUS (⭐)</span>.
            </p>
            <p>
              💀 <strong className="text-neon-red">Piège :</strong> Évitez les paquets piégés <span className="text-neon-red font-bold">GLACE (💀)</span> qui altèrent vos données.
            </p>
            <p>
              ⏱ <strong className="text-neon-cyan">Objectif :</strong> Récoltez <span className="text-neon-green font-bold">{params.requiredData}</span> paquets avant la fin du temps imparti (<span className="text-neon-red font-bold">{params.timeLimit}s</span>).
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer le siphon
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
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-neon-cyan/15 px-3 py-1.5 text-xs font-bold text-neon-cyan border border-neon-cyan/40 shadow-[0_0_8px_rgba(46,230,255,0.2)]">
              <span className="h-2.5 w-2.5 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_6px_var(--color-neon-cyan)]" />
              Siphonné : {collected} / {params.requiredData}
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

      {/* Lanes Area */}
      <div
        className={`relative mx-auto grid h-[calc(100vh-180px)] max-h-[440px] w-full rounded-lg border bg-panel overflow-hidden transition-shadow ${
          flash === 'ice'
            ? 'border-neon-red shadow-[0_0_30px_rgba(255,0,85,0.6)]'
            : flash === 'hit'
              ? 'border-neon-green shadow-[0_0_20px_rgba(0,255,136,0.3)]'
              : 'border-grid'
        }`}
        style={{ gridTemplateColumns: `repeat(${params.columns}, minmax(0, 1fr))` }}
      >
        {/* Columns Background */}
        {Array.from({ length: params.columns }).map((_, i) => (
          <div key={i} className="h-full border-r border-grid/40 last:border-r-0 bg-panel-2/30" />
        ))}

        {/* Packets */}
        {packets.map((p) => {
          const colWidthPercent = 100 / params.columns;
          const leftPercent = p.col * colWidthPercent;

          return (
            <button
              key={p.id}
              className={`absolute flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-bold border transition-transform active:scale-90 cursor-pointer select-none ${
                p.type === 'data'
                  ? 'border-neon-green bg-neon-green/20 text-neon-green shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                  : p.type === 'bonus'
                    ? 'border-neon-amber bg-neon-amber/25 text-neon-amber shadow-[0_0_14px_rgba(255,180,0,0.5)] animate-pulse'
                    : 'border-neon-red bg-neon-red/25 text-neon-red shadow-[0_0_12px_rgba(255,0,85,0.4)]'
              }`}
              style={{
                left: `calc(${leftPercent}% + 4px)`,
                width: `calc(${colWidthPercent}% - 8px)`,
                top: `${p.y}%`,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                handlePacketClick(p.id, p.type);
              }}
            >
              <span>{p.type === 'data' ? '💾' : p.type === 'bonus' ? '⭐' : '💀'}</span>
              <span className="uppercase text-[10px] tracking-wider font-extrabold">
                {p.type === 'data' ? 'DATA' : p.type === 'bonus' ? '+2 DATA' : 'GLACE'}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-ink-dim">
        Cliquez sur les paquets <span className="text-neon-green font-bold">DATA</span> et <span className="text-neon-amber font-bold">BONUS</span>. Évitez les paquets <span className="text-neon-red font-bold">GLACE</span>.
      </p>
    </div>
  );
}
