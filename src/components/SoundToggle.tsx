import { useState } from 'react';
import { playSound, setSoundEnabled, soundEnabled } from '../audio/sound';

export function SoundToggle() {
  const [enabled, setEnabled] = useState(soundEnabled);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) void playSound('success');
  };

  return (
    <button
      className={`btn px-2 py-1 text-xs ${enabled ? 'btn-cyan active' : ''}`}
      aria-label={enabled ? 'Couper les sons' : 'Activer les sons'}
      data-sound-toggle
      aria-pressed={enabled}
      title={enabled ? 'Sons activés' : 'Sons coupés'}
      onClick={toggle}
    >
      {enabled ? '◖))' : '◖×'}
    </button>
  );
}
