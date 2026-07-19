import { useEffect, useRef, useState } from 'react';
import type { JammingParams, MiniGameProgress } from '../../types';
import type { MiniGameProps } from '../types';

interface Packet {
  id: number;
  x: number;
  y: number;
  speed: number;
  glyph: string;
}

const GLYPHS = ['TRACE', 'PING', 'LOCK', 'ID'];

export function JammingGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<JammingParams, MiniGameProgress>) {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [seconds, setSeconds] = useState(params.duration);
  const [destroyed, setDestroyed] = useState(0);
  const [misses, setMisses] = useState(0);
  const finished = useRef(false);
  const nextId = useRef(1);
  const spawnElapsed = useRef(0);
  const destroyedRef = useRef(0);
  const missesRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      spawnElapsed.current += 80;
      setPackets((current) => {
        let next = current.map((packet) => ({ ...packet, y: packet.y + packet.speed }));
        const escaped = next.filter((packet) => packet.y >= 0.94).length;
        next = next.filter((packet) => packet.y < 0.94);
        if (escaped > 0 && !finished.current) {
          setMisses((value) => {
            const updated = value + escaped;
            missesRef.current = updated;
            if (updated >= params.maxMisses) {
              finished.current = true;
              window.setTimeout(() => onResult(false), 0);
            }
            return updated;
          });
        }
        if (spawnElapsed.current >= params.spawnInterval && !finished.current) {
          spawnElapsed.current = 0;
          next.push({
            id: nextId.current++,
            x: 8 + Math.random() * 84,
            y: 0.02,
            speed: 0.012 + Math.random() * 0.009,
            glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          });
        }
        return next;
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [onResult, params.maxMisses, params.spawnInterval]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        const next = value - 1;
        if (next <= 0 && !finished.current) {
          finished.current = true;
          onResult(true);
        }
        onProgress({
          label: 'Signal tenu',
          value: params.duration - Math.max(0, next),
          total: params.duration,
          detail: `${destroyedRef.current} paquets dissipés · ${missesRef.current}/${params.maxMisses} passés`,
        });
        return Math.max(0, next);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onProgress, onResult, params.duration, params.maxMisses]);

  const destroy = (id: number) => {
    if (finished.current) return;
    setPackets((current) => current.filter((packet) => packet.id !== id));
    setDestroyed((value) => {
      const next = value + 1;
      destroyedRef.current = next;
      return next;
    });
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neon-cyan">Paquets dissipés : {destroyed}</span>
        <span className={misses > 0 ? 'text-neon-red' : 'text-ink-dim'}>
          Fuites : {misses}/{params.maxMisses}
        </span>
        <span className={seconds <= 6 ? 'pulse-alert text-neon-amber' : 'text-neon-green'}>{seconds}s</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded border border-neon-cyan-dim bg-panel/80">
        <div className="absolute inset-x-0 bottom-[5%] h-px bg-neon-red shadow-[0_0_12px_var(--color-neon-red)]" />
        <div className="absolute inset-x-0 bottom-0 h-[5%] bg-neon-red/10" />
        {packets.map((packet) => (
          <button
            key={packet.id}
            className="absolute min-h-10 -translate-x-1/2 -translate-y-1/2 rounded border border-neon-magenta bg-neon-magenta/15 px-2 text-[10px] text-neon-magenta shadow-[0_0_10px_var(--color-neon-magenta)]"
            style={{ left: `${packet.x}%`, top: `${packet.y * 100}%` }}
            onPointerDown={() => destroy(packet.id)}
          >
            {packet.glyph}
          </button>
        ))}
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
          <span className="glow-text text-2xl text-neon-cyan">◉</span>
          <p className="text-[8px] text-neon-cyan">PERSONA</p>
        </div>
      </div>
      <p className="text-center text-[10px] text-ink-dim">
        Touchez les paquets de trace avant qu’ils atteignent votre persona.
      </p>
    </div>
  );
}
