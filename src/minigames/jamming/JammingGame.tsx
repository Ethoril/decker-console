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
  const [showTutorial, setShowTutorial] = useState(true);
  const finished = useRef(false);
  const nextId = useRef(1);
  const spawnElapsed = useRef(0);
  const destroyedRef = useRef(0);
  const missesRef = useRef(0);

  useEffect(() => {
    if (showTutorial) return;
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
  }, [onResult, params.maxMisses, params.spawnInterval, showTutorial]);

  useEffect(() => {
    if (showTutorial) return;
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
  }, [onProgress, onResult, params.duration, params.maxMisses, showTutorial]);

  const destroy = (id: number) => {
    if (finished.current) return;
    setPackets((current) => current.filter((packet) => packet.id !== id));
    setDestroyed((value) => {
      const next = value + 1;
      destroyedRef.current = next;
      return next;
    });
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
            Brouillage Anti-Pistage
          </h2>
          
          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />
          
          <p className="text-xs text-ink leading-relaxed text-left">
            Des paquets de pistage réseau (<strong>TRACE</strong>, <strong>PING</strong>, etc.) tentent de localiser votre position.
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2">
            <p>
              ⚡ <strong className="text-neon-magenta">Action :</strong> Touchez ou cliquez sur les paquets de données pour les dissiper avant qu'ils n'atteignent la ligne rouge de votre Persona en bas.
            </p>
            <p>
              ⏱ <strong className="text-neon-cyan">Objectif :</strong> Tenez bon pendant <span className="text-neon-cyan font-bold">{params.duration}s</span>.
            </p>
            <p>
              ⚠ <strong className="text-neon-red">Menace :</strong> Si plus de <span className="text-neon-red font-bold">{params.maxMisses}</span> paquets fuient au-delà de la ligne rouge, le brouillage échoue.
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer le brouillage
          </button>
        </div>
      </div>
    );
  }

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
