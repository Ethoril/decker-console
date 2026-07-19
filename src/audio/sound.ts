export type SoundCue = 'tap' | 'message' | 'alert' | 'success' | 'convergence';

const STORAGE_KEY = 'decker-console-sound';
let context: AudioContext | null = null;

export function soundEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'on';
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  if (enabled) void ensureContext();
}

async function ensureContext(): Promise<AudioContext | null> {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  context ??= new AudioContextClass();
  if (context.state === 'suspended') await context.resume();
  return context;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gainValue: number,
  type: OscillatorType = 'square',
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Sons courts synthétisés : aucun fichier audio ni chargement réseau. */
export async function playSound(cue: SoundCue): Promise<void> {
  if (!soundEnabled()) return;
  const ctx = await ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (cue === 'tap') tone(ctx, 520, now, 0.035, 0.018);
  if (cue === 'message') {
    tone(ctx, 660, now, 0.05, 0.025);
    tone(ctx, 880, now + 0.055, 0.05, 0.02);
  }
  if (cue === 'success') {
    tone(ctx, 440, now, 0.08, 0.035, 'sine');
    tone(ctx, 660, now + 0.075, 0.1, 0.035, 'sine');
    tone(ctx, 880, now + 0.15, 0.14, 0.03, 'sine');
  }
  if (cue === 'alert') {
    tone(ctx, 180, now, 0.13, 0.045, 'sawtooth');
    tone(ctx, 135, now + 0.14, 0.16, 0.045, 'sawtooth');
  }
  if (cue === 'convergence') {
    for (let i = 0; i < 5; i += 1) {
      tone(ctx, i % 2 === 0 ? 110 : 82, now + i * 0.22, 0.18, 0.055, 'sawtooth');
    }
  }
}
