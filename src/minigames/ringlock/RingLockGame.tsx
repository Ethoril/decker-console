import { useEffect, useRef, useState } from 'react';
import type { MiniGameProgress, RingLockParams } from '../../types';
import type { MiniGameProps } from '../types';

export function RingLockGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<RingLockParams, MiniGameProgress>) {
  // Initial random angles for rings (15° to 345° away from 0° target)
  const [angles, setAngles] = useState<number[]>(() => {
    return Array.from({ length: params.ringCount }, () => {
      const offset = 45 + Math.floor(Math.random() * 270);
      return (offset % 360);
    });
  });

  const [selectedRing, setSelectedRing] = useState<number>(0);
  const [seconds, setSeconds] = useState(params.timeLimit);
  const [showTutorial, setShowTutorial] = useState(true);

  const finished = useRef(false);
  const secondsRef = useRef(params.timeLimit);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

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

  // Check alignment
  useEffect(() => {
    if (showTutorial || finished.current) return;

    let aligned = 0;
    angles.forEach((ang) => {
      // Distance from 0° (top)
      const diff = Math.abs((ang % 360 + 360) % 360);
      const distFromTop = Math.min(diff, 360 - diff);
      if (distFromTop <= params.tolerance) {
        aligned++;
      }
    });

    onProgress({
      label: 'Nœuds verrouillés',
      value: aligned,
      total: params.ringCount,
      detail: `${aligned}/${params.ringCount} anneaux alignés`,
    });

    if (aligned === params.ringCount && !finished.current) {
      finished.current = true;
      window.setTimeout(() => onResult(true), 300);
    }
  }, [angles, params, onProgress, onResult, showTutorial]);

  const rotateSelectedRing = (deltaDeg: number) => {
    if (finished.current) return;
    setAngles((prev) => {
      const next = [...prev];
      next[selectedRing] = (next[selectedRing] + deltaDeg + 360) % 360;
      return next;
    });
  };

  const handlePointer = (clientX: number, clientY: number) => {
    if (!wheelRef.current || finished.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Angle relative to center (0° is Top)
    const rad = Math.atan2(clientY - centerY, clientX - centerX);
    let deg = (rad * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    setAngles((prev) => {
      const next = [...prev];
      next[selectedRing] = Math.round(deg) % 360;
      return next;
    });
  };

  const ringColors = [
    { border: 'border-neon-cyan', bg: 'bg-neon-cyan/15', glow: 'shadow-[0_0_15px_var(--color-neon-cyan)]', text: 'text-neon-cyan' },
    { border: 'border-neon-magenta', bg: 'bg-neon-magenta/15', glow: 'shadow-[0_0_15px_var(--color-neon-magenta)]', text: 'text-neon-magenta' },
    { border: 'border-neon-amber', bg: 'bg-neon-amber/15', glow: 'shadow-[0_0_15px_var(--color-neon-amber)]', text: 'text-neon-amber' },
    { border: 'border-neon-green', bg: 'bg-neon-green/15', glow: 'shadow-[0_0_15px_var(--color-neon-green)]', text: 'text-neon-green' },
  ];

  if (showTutorial) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 text-center p-4">
        <div className="border border-neon-cyan/50 bg-panel p-6 rounded-lg shadow-[0_0_20px_rgba(46,230,255,0.15)] flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">
            <span>Tutoriel</span>
            <span>Sécurité Matricielle</span>
          </div>

          <h2 className="glitch-text text-xl font-bold tracking-wider text-neon-cyan uppercase">
            Alignement de Verrou
          </h2>

          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />

          <p className="text-xs text-ink leading-relaxed text-left">
            Alignez les encoches des anneaux concentriques sur le faisceau optique supérieur pour déverrouiller l'accès au nœud.
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2.5">
            <p>
              🔄 <strong className="text-neon-cyan">Action :</strong> Sélectionnez chaque anneau et faites-le tourner au doigt ou via les boutons pour aligner les encoches vers le haut (12h).
            </p>
            <p>
              ⚡ <strong className="text-neon-green">Verrouillage :</strong> Lorsqu'une encoche s'aligne sur le laser, l'anneau s'illumine en vert.
            </p>
            <p>
              ⏱ <strong className="text-neon-red">Menace :</strong> Alignez les <span className="text-neon-cyan font-bold">{params.ringCount} anneaux</span> avant la fin du temps imparti (<span className="text-neon-red font-bold">{params.timeLimit}s</span>).
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer le déverrouillage
          </button>
        </div>
      </div>
    );
  }

  // Count current aligned rings
  const alignedCount = angles.filter((ang) => {
    const diff = Math.abs((ang % 360 + 360) % 360);
    return Math.min(diff, 360 - diff) <= params.tolerance;
  }).length;

  const progressPercent = Math.round((alignedCount / params.ringCount) * 100);

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-3">
      {/* Top HUD */}
      <div className="flex flex-col gap-2 rounded-lg border border-grid bg-panel-2 p-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase border transition-all ${
              alignedCount === params.ringCount
                ? 'border-neon-green bg-neon-green/20 text-neon-green shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                : 'border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan'
            }`}>
              <span className={`h-2.5 w-2.5 rounded-full ${alignedCount > 0 ? 'bg-neon-green animate-pulse' : 'bg-neon-cyan'}`} />
              Anneaux alignés : {alignedCount} / {params.ringCount}
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

      {/* Ring Wheel View */}
      <div className="relative flex flex-1 items-center justify-center min-h-[260px] max-h-[360px] rounded-lg border border-grid bg-panel p-4 overflow-hidden">
        {/* Laser Target Beam (Vertical Top) */}
        <div className="absolute top-0 bottom-1/2 left-1/2 w-1 -translate-x-1/2 bg-gradient-to-t from-neon-green via-neon-cyan to-transparent shadow-[0_0_12px_var(--color-neon-green)] z-10 pointer-events-none" />
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-neon-green/20 text-neon-green text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-neon-green/40 shadow-[0_0_8px_var(--color-neon-green)] z-20">
          ▲ FAISCEAU OPTIQUE
        </div>

        {/* Interactive Dial Container */}
        <div
          ref={wheelRef}
          className="relative h-64 w-64 rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            isDraggingRef.current = true;
            handlePointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!isDraggingRef.current) return;
            handlePointer(e.clientX, e.clientY);
          }}
          onPointerUp={() => { isDraggingRef.current = false; }}
          onPointerCancel={() => { isDraggingRef.current = false; }}
        >
          {/* Render Rings from Outer to Inner */}
          {angles.map((angle, idx) => {
            const sizePx = 250 - idx * 52;
            const diff = Math.abs((angle % 360 + 360) % 360);
            const isAligned = Math.min(diff, 360 - diff) <= params.tolerance;
            const isSelected = selectedRing === idx;
            const color = ringColors[idx % ringColors.length];

            return (
              <div
                key={idx}
                className={`absolute rounded-full border-4 transition-transform duration-75 flex items-center justify-center ${
                  isAligned
                    ? 'border-neon-green bg-neon-green/10 shadow-[0_0_20px_var(--color-neon-green)]'
                    : isSelected
                      ? `${color.border} ${color.bg} ${color.glow} ring-2 ring-white/50`
                      : `${color.border}/50 bg-panel-2/40`
                }`}
                style={{
                  width: `${sizePx}px`,
                  height: `${sizePx}px`,
                  transform: `rotate(${angle}deg)`,
                }}
              >
                {/* Notch Node at Top of the Ring */}
                <div
                  className={`absolute -top-3 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isAligned
                      ? 'border-white bg-neon-green text-black shadow-[0_0_12px_white] scale-110'
                      : `${color.border} bg-panel text-white shadow-[0_0_8px_var(--color-neon-cyan)]`
                  }`}
                >
                  <span className="text-[9px] font-mono font-black">{idx + 1}</span>
                </div>
              </div>
            );
          })}

          {/* Central Core */}
          <div className="relative h-12 w-12 rounded-full border-2 border-neon-green bg-panel-2 shadow-[0_0_15px_var(--color-neon-green)] flex items-center justify-center z-20">
            <span className="text-lg animate-pulse">{alignedCount === params.ringCount ? '🔓' : '🔒'}</span>
          </div>
        </div>
      </div>

      {/* Controls & Ring Selection */}
      <div className="flex flex-col gap-2 rounded-lg border border-grid bg-panel p-3">
        <div className="flex items-center justify-between text-xs font-bold text-ink-dim uppercase">
          <span>Sélection d'anneau :</span>
          <span className="text-neon-cyan">Anneau {selectedRing + 1} ({Math.round(angles[selectedRing])}°)</span>
        </div>

        {/* Ring Selection Tabs */}
        <div className="grid grid-cols-4 gap-2">
          {angles.map((angle, idx) => {
            const diff = Math.abs((angle % 360 + 360) % 360);
            const isAligned = Math.min(diff, 360 - diff) <= params.tolerance;
            const isSelected = selectedRing === idx;

            return (
              <button
                key={idx}
                className={`btn py-2 text-xs font-bold transition-all ${
                  isAligned
                    ? 'border-neon-green bg-neon-green/20 text-neon-green shadow-[0_0_8px_rgba(0,255,136,0.3)]'
                    : isSelected
                      ? 'btn-cyan active font-black'
                      : 'opacity-60'
                }`}
                onClick={() => setSelectedRing(idx)}
              >
                {isAligned ? '✓ ' : ''}Anneau {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Precision Rotation Buttons */}
        <div className="grid grid-cols-4 gap-2 mt-1">
          <button
            className="btn btn-cyan py-2.5 text-xs font-black cursor-pointer active:scale-95"
            onClick={() => rotateSelectedRing(-15)}
          >
            ↺ -15°
          </button>
          <button
            className="btn btn-cyan py-2.5 text-xs font-black cursor-pointer active:scale-95"
            onClick={() => rotateSelectedRing(-5)}
          >
            ↺ -5°
          </button>
          <button
            className="btn btn-cyan py-2.5 text-xs font-black cursor-pointer active:scale-95"
            onClick={() => rotateSelectedRing(5)}
          >
            ↻ +5°
          </button>
          <button
            className="btn btn-cyan py-2.5 text-xs font-black cursor-pointer active:scale-95"
            onClick={() => rotateSelectedRing(15)}
          >
            ↻ +15°
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-ink-dim">
        Glissez sur le disque ou utilisez les boutons pour orienter les encoches vers le haut (▲).
      </p>
    </div>
  );
}
