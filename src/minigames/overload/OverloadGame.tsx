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
  const direction = useRef(1);
  const previous = useRef<number | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    let frame = 0;
    const tick = (time: number) => {
      if (previous.current === null) previous.current = time;
      const delta = Math.min(0.04, (time - previous.current) / 1000);
      previous.current = time;
      setPosition((value) => {
        let next = value + direction.current * params.speed * (1 + hits * 0.12) * delta;
        if (next >= 1) { next = 1; direction.current = -1; }
        if (next <= 0) { next = 0; direction.current = 1; }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hits, params.speed]);

  const stopNeedle = () => {
    if (finished.current) return;
    const hit = Math.abs(position - 0.5) <= params.zoneWidth / 2;
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

  const left = 50 - params.zoneWidth * 50;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p className="text-xs tracking-wider text-ink-dim uppercase">Stabilisez le flux</p>
        <p className="mt-1 text-sm text-neon-cyan">
          {hits}/{params.requiredHits} paliers · {misses} dégât(s) de surcharge
        </p>
      </div>

      <div
        className={`relative h-24 w-full overflow-hidden rounded border bg-panel-2 ${
          flash === 'hit'
            ? 'border-neon-green shadow-[0_0_24px_var(--color-neon-green)]'
            : flash === 'miss'
              ? 'border-neon-red shadow-[0_0_24px_var(--color-neon-red)]'
              : 'border-grid'
        }`}
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

      <button className="btn btn-cyan min-h-16 w-full max-w-md text-lg" onClick={stopNeedle}>
        COUPER LE FLUX
      </button>
      <p className="max-w-md text-center text-[11px] leading-5 text-ink-dim">
        Arrêtez l’aiguille dans la zone verte. Chaque raté inflige 1 dégât ; deux ratés
        consécutifs font échouer la surcharge.
      </p>
    </div>
  );
}
