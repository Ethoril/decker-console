import { useEffect, useMemo, useRef, useState } from 'react';
import type { MiniGameProgress, SignalParams } from '../../types';
import type { MiniGameProps } from '../types';

export function SignalGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<SignalParams, MiniGameProgress>) {
  // Generates target waveform values quantized to slider steps so exact alignment is always possible!
  const target = useMemo(() => {
    const stepAmp = 0.05;
    const stepFreq = 0.1;
    const stepPhase = 0.1;
    const ampSteps = 9; // 0.30 to 0.70
    const freqSteps = 19; // 0.8 to 2.6
    const phaseSteps = 60; // 0 to ~6.0

    return {
      amplitude: Number((0.3 + Math.floor(Math.random() * ampSteps) * stepAmp).toFixed(2)),
      frequency: Number((0.8 + Math.floor(Math.random() * freqSteps) * stepFreq).toFixed(2)),
      phase: Number((Math.floor(Math.random() * phaseSteps) * stepPhase).toFixed(2)),
    };
  }, []);

  // Player slider values
  const [amp, setAmp] = useState(0.5);
  const [freq, setFreq] = useState(1.5);
  const [phase, setPhase] = useState(0);

  const [seconds, setSeconds] = useState(params.timeLimit);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 1
  const [matchScore, setMatchScore] = useState(0); // 0 to 100%
  const [showTutorial, setShowTutorial] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const finished = useRef(false);
  const holdTimeRef = useRef(0);
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

  // Main Animation Frame Loop (Waveform render + Match check)
  useEffect(() => {
    if (showTutorial) return;
    let animationFrame = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const targetPhase = target.phase;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const centerY = height / 2;

          ctx.clearRect(0, 0, width, height);

          // Draw grid lines
          ctx.strokeStyle = 'rgba(46, 230, 255, 0.1)';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = 0; y < height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // Center axis
          ctx.strokeStyle = 'rgba(46, 230, 255, 0.25)';
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          ctx.lineTo(width, centerY);
          ctx.stroke();

          // Draw Target Wave (Neon Magenta)
          ctx.strokeStyle = '#ff0080';
          ctx.shadowColor = '#ff0080';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let x = 0; x < width; x++) {
            const t = (x / width) * Math.PI * 4 * target.frequency + targetPhase;
            const y = centerY + Math.sin(t) * (height * 0.38) * target.amplitude;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Draw Player Wave (Neon Cyan)
          ctx.strokeStyle = '#2ee6ff';
          ctx.shadowColor = '#2ee6ff';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let x = 0; x < width; x++) {
            const t = (x / width) * Math.PI * 4 * freq + phase;
            const y = centerY + Math.sin(t) * (height * 0.38) * amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        }
      }

      // Calculate Match Error
      const ampErr = Math.abs(amp - target.amplitude);
      const freqErr = Math.abs(freq - target.frequency) / 2.5;
      let phaseDiff = Math.abs(phase - targetPhase) % (Math.PI * 2);
      if (phaseDiff > Math.PI) phaseDiff = Math.PI * 2 - phaseDiff;
      const phaseErr = phaseDiff / Math.PI;

      const totalErr = params.sliderCount === 2 
        ? (ampErr + freqErr) / 2 
        : (ampErr + freqErr + phaseErr) / 3;

      const currentScore = Math.max(0, Math.round((1 - totalErr) * 100));
      setMatchScore(currentScore);

      const tolerance = params.tolerance || 0.15;
      const isMatching = totalErr <= tolerance;

      if (isMatching && !finished.current) {
        holdTimeRef.current += delta;
        const currentHold = Math.min(1, holdTimeRef.current / params.holdTime);
        setHoldProgress(currentHold);

        onProgress({
          label: 'Synchronisation',
          value: Math.round(currentHold * 100),
          total: 100,
          detail: `${secondsRef.current}s · Sync ${Math.round(currentHold * 100)}%`,
        });

        if (currentHold >= 1) {
          finished.current = true;
          onResult(true);
        }
      } else if (!finished.current) {
        holdTimeRef.current = Math.max(0, holdTimeRef.current - delta * 1.5);
        setHoldProgress(holdTimeRef.current / params.holdTime);
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [amp, freq, phase, params, target, onProgress, onResult, showTutorial]);

  const syncPercent = Math.round(holdProgress * 100);

  if (showTutorial) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 text-center p-4">
        <div className="border border-neon-cyan/50 bg-panel p-6 rounded-lg shadow-[0_0_20px_rgba(46,230,255,0.15)] flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">
            <span>Tutoriel</span>
            <span>Sécurité Matricielle</span>
          </div>

          <h2 className="glitch-text text-xl font-bold tracking-wider text-neon-cyan uppercase">
            Analyse de Signal
          </h2>

          <div className="mx-auto h-px w-full bg-neon-cyan/30 my-1" />

          <p className="text-xs text-ink leading-relaxed text-left">
            Bypassez la signature fréquentielle de la Glace en ajustant votre onde réseau.
          </p>

          <div className="rounded bg-panel-2 p-3 text-[11px] text-ink-dim leading-relaxed text-left space-y-2.5">
            <p>
              🎛️ <strong className="text-neon-magenta">Action :</strong> Ajustez les curseurs d'amplitude, fréquence et phase pour aligner l'onde cyan sur l'onde magenta.
            </p>
            <p>
              ⏱ <strong className="text-neon-cyan">Objectif :</strong> Superposez les deux ondes et maintenez le signal verrouillé pendant <span className="text-neon-cyan font-bold">{params.holdTime}s</span>.
            </p>
            <p>
              ⚠ <strong className="text-neon-red">Menace :</strong> Réussissez avant la fin du temps imparti (<span className="text-neon-red font-bold">{params.timeLimit}s</span>).
            </p>
          </div>

          <button
            className="btn btn-cyan mt-2 py-3 text-xs font-bold tracking-widest uppercase cursor-pointer"
            onClick={() => setShowTutorial(false)}
          >
            Démarrer l'analyse
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
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase border transition-all ${
              holdProgress > 0
                ? 'border-neon-green bg-neon-green/20 text-neon-green shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                : 'border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan'
            }`}>
              <span className={`h-2.5 w-2.5 rounded-full ${holdProgress > 0 ? 'bg-neon-green animate-ping' : 'bg-neon-cyan'}`} />
              Alignement : {matchScore}% (Verrouillage : {syncPercent}%)
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
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-green transition-all duration-100 shadow-[0_0_10px_var(--color-neon-green)]"
            style={{ width: `${syncPercent}%` }}
          />
        </div>
      </div>

      {/* Oscilloscope Canvas */}
      <div className="relative overflow-hidden rounded-lg border border-neon-cyan/40 bg-panel-2/90 shadow-[0_0_20px_rgba(46,230,255,0.15)]">
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="h-44 w-full block"
        />

        {/* Legend */}
        <div className="absolute top-2 right-2 flex items-center gap-3 bg-panel/90 px-2.5 py-1 rounded text-[10px] border border-grid backdrop-blur-xs">
          <span className="flex items-center gap-1 text-neon-magenta font-bold">
            <span className="h-2 w-2 rounded-full bg-neon-magenta" /> CIBLE
          </span>
          <span className="flex items-center gap-1 text-neon-cyan font-bold">
            <span className="h-2 w-2 rounded-full bg-neon-cyan" /> DECKER
          </span>
        </div>
      </div>

      {/* Controls Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg border border-grid bg-panel p-3">
        {/* Slider 1: Amplitude */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px] font-bold text-neon-cyan uppercase">
            <span>Amplitude</span>
            <span>{Math.round(amp * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={amp}
            onChange={(e) => setAmp(parseFloat(e.target.value))}
            className="w-full accent-neon-cyan cursor-pointer h-2"
          />
        </div>

        {/* Slider 2: Frequency */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px] font-bold text-neon-cyan uppercase">
            <span>Fréquence</span>
            <span>{freq.toFixed(1)} Hz</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={freq}
            onChange={(e) => setFreq(parseFloat(e.target.value))}
            className="w-full accent-neon-cyan cursor-pointer h-2"
          />
        </div>

        {/* Slider 3: Phase */}
        {params.sliderCount === 3 && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-bold text-neon-cyan uppercase">
              <span>Phase</span>
              <span>{phase.toFixed(1)} rad</span>
            </div>
            <input
              type="range"
              min="0"
              max="6.0"
              step="0.1"
              value={phase}
              onChange={(e) => setPhase(parseFloat(e.target.value))}
              className="w-full accent-neon-cyan cursor-pointer h-2"
            />
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-ink-dim">
        Ajustez les curseurs pour superposer l'onde <span className="text-neon-cyan font-bold">cyan</span> sur l'onde <span className="text-neon-magenta font-bold">magenta</span>.
      </p>
    </div>
  );
}
