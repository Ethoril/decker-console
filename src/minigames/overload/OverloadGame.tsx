import { useEffect, useRef, useState } from 'react';
import type { MiniGameProgress, OverloadParams } from '../../types';
import type { MiniGameProps } from '../types';

export function OverloadGame({
  params,
  onProgress,
  onResult,
  onMiss,
}: MiniGameProps<OverloadParams, MiniGameProgress> & { onMiss: () => void }) {
  const [position, setPosition] = useState(0.08);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [consecutiveMisses, setConsecutiveMisses] = useState(0);
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const direction = useRef(1);
  const previous = useRef<number | null>(null);
  const finished = useRef(false);
  const positionRef = useRef(0.08);
  const lastInputTime = useRef(0);

  useEffect(() => {
    if (showTutorial) return;
    let frame = 0;
    previous.current = null;
    const tick = (time: number) => {
      if (previous.current === null) previous.current = time;
      const delta = Math.min(0.04, (time - previous.current) / 1000);
      previous.current = time;
      
      let next = positionRef.current + direction.current * params.speed * (1 + hits * 0.12) * delta;
      if (next >= 1) { next = 1; direction.current = -1; }
      if (next <= 0) { next = 0; direction.current = 1; }
      
      positionRef.current = next;
      setPosition(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hits, params.speed, showTutorial]);

  const stopNeedle = () => {
    if (finished.current) return;
    const now = performance.now();
    if (now - lastInputTime.current < 200) return;
    lastInputTime.current = now;

    // Use current real-time position from positionRef with a tiny generous buffer (+0.005)
    const currentPos = positionRef.current;
    const hit = Math.abs(currentPos - 0.5) <= (params.zoneWidth / 2) + 0.005;
    if (hit) {
      const nextHits = hits + 1;
      setHits(nextHits);
      setConsecutiveMisses(0);
      setFlash('hit');
      onProgress({
        label: 'Paliers stabilisés',
        value: nextHits,
        total: params.requiredHits,
        detail: `${misses} surcharge(s) subie(s)`,
      });
      if (nextHits >= params.requiredHits) {
        finished.current = true;
        onResult(true);
      }
    } else {
      const nextMisses = misses + 1;
      const nextConsecutive = consecutiveMisses + 1;
      setMisses(nextMisses);
      setConsecutiveMisses(nextConsecutive);
      setFlash('miss');
      onMiss();
      onProgress({
        label: 'Paliers stabilisés',
        value: hits,
        total: params.requiredHits,
        detail: `${nextMisses} surcharge(s), ${nextConsecutive}/2 consécutive(s)`,
      });
      if (nextConsecutive >= 2) {
        finished.current = true;
        onResult(false);
      }
    }
    window.setTimeout(() => setFlash(null), 220);
  };

  const stopNeedleRef = useRef(stopNeedle);
  stopNeedleRef.current = stopNeedle;

  useEffect(() => {
    if (showTutorial) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        stopNeedleRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTutorial]);

  const left = 50 - params.zoneWidth * 50;

  if (showTutorial) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 text-center p-4">
        <div className="border border-neon-cyan/50 bg-panel p-6 rounded-lg shadow-[0_0_20px_rgba(46,230,255,0.15)] flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">
            <span>Tutoriel</span>
            <span>Sécurité Matricielle</span>
          </div>
          
          <h2 className="glitch-text text-xl font-bold tracking-wider text-neon-cyan uppercase">
            Surcharge Système
          </h2>
          
          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />
          
          <p className="text-xs text-ink leading-relaxed text-left">
            Surchargez les sous-systèmes de sécurité du nœud pour forcer l'accès.
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2">
            <p>
              ⚡ <strong className="text-neon-magenta">Action :</strong> Appuyez sur <span className="text-neon-cyan font-bold">ESPACE</span>, <span className="text-neon-cyan font-bold">ENTRÉE</span> ou cliquez sur le bouton lorsque l'aiguille se trouve dans la zone verte.
            </p>
            <p>
              ⏱ <strong className="text-neon-cyan">Objectif :</strong> Stabilisez le flux réseau en réussissant <span className="text-neon-cyan font-bold">{params.requiredHits}</span> paliers. La vitesse de l'aiguille augmente après chaque réussite !
            </p>
            <p>
              ⚠ <strong className="text-neon-red">Menace :</strong> Chaque raté inflige 1 dégât au cyberdeck. Deux ratés consécutifs font échouer la surcharge.
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer la surcharge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p className="text-xs tracking-wider text-ink-dim uppercase">Stabilisez le flux</p>
        <p className="mt-1 text-sm text-neon-cyan">
          {hits}/{params.requiredHits} paliers · {misses} dégât(s) de surcharge
        </p>
      </div>

      <div
        className={`relative h-24 w-full overflow-hidden rounded border bg-panel-2 cursor-pointer select-none ${
          flash === 'hit'
            ? 'border-neon-green shadow-[0_0_24px_var(--color-neon-green)]'
            : flash === 'miss'
              ? 'border-neon-red shadow-[0_0_24px_var(--color-neon-red)]'
              : 'border-grid'
        }`}
        onPointerDown={(e) => {
          e.preventDefault();
          stopNeedle();
        }}
      >
        <div
          className="absolute inset-y-0 bg-neon-green/20 shadow-[0_0_24px_var(--color-neon-green)]"
          style={{ left: `${left}%`, width: `${params.zoneWidth * 100}%` }}
        />
        <div className="absolute inset-x-0 top-1/2 h-px bg-grid" />
        <div
          className="absolute inset-y-2 w-1 -translate-x-1/2 bg-neon-cyan shadow-[0_0_12px_var(--color-neon-cyan)]"
          style={{ left: `${position * 100}%` }}
        />
      </div>

      <button
        type="button"
        className="btn btn-cyan min-h-16 w-full max-w-md text-lg cursor-pointer select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          stopNeedle();
        }}
      >
        COUPER LE FLUX <span className="text-xs opacity-75 font-normal ml-2">(ESPACE)</span>
      </button>
      <p className="max-w-md text-center text-[11px] leading-5 text-ink-dim">
        Arrêtez l’aiguille dans la zone verte. Chaque raté inflige 1 dégât ; deux ratés
        consécutifs font échouer la surcharge.
      </p>
    </div>
  );
}

