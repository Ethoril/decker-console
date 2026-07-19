import { useEffect, useRef } from 'react';
import { playSound } from '../audio/sound';
import { useNetworkStore } from '../store/network';

/** Réagit aux nouveaux événements synchronisés sans produire de boucle sonore. */
export function SessionSoundscape() {
  const log = useNetworkStore((s) => s.log);
  const convergence = useNetworkStore((s) => s.decker.convergence ?? false);
  const seenLog = useRef<Set<string> | null>(null);
  const previousConvergence = useRef(false);

  useEffect(() => {
    const ids = Object.keys(log);
    if (seenLog.current === null) {
      seenLog.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seenLog.current?.has(id));
    for (const id of fresh) {
      const entry = log[id];
      if (entry.kind === 'alert' || entry.kind === 'damage') void playSound('alert');
      else if (/réussi|Mark/i.test(entry.text)) void playSound('success');
      else if (entry.kind === 'roll') void playSound('message');
      else void playSound('tap');
      seenLog.current.add(id);
    }
  }, [log]);

  useEffect(() => {
    if (convergence && !previousConvergence.current) void playSound('convergence');
    previousConvergence.current = convergence;
  }, [convergence]);

  useEffect(() => {
    const onPointerUp = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest('button');
      if (button && !button.hasAttribute('data-sound-toggle')) void playSound('tap');
    };
    document.addEventListener('pointerup', onPointerUp);
    return () => document.removeEventListener('pointerup', onPointerUp);
  }, []);

  return null;
}
