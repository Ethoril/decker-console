import { useMemo, useState } from 'react';
import type { InjectionParams, MiniGameProgress } from '../../types';
import type { MiniGameProps } from '../types';

interface Attempt {
  guess: number[];
  correct: number;
  misplaced: number;
}

// Composant de rendu des glyphes vectoriels de haute fidélité
export function GlyphIcon({ index, className = "w-6 h-6" }: { index: number; className?: string }) {
  const glyphs = [
    // 0: Triangle circuit
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path d="M12 3L2 20H22L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" className="fill-current" />
      <path d="M12 5.5V9.5M6.5 17L9.5 14.5M17.5 17L14.5 14.5" strokeLinecap="round" />
    </svg>,
    // 1: Concentric target/broken rings
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="5 2.5" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" className="fill-current" />
    </svg>,
    // 2: Cyber diamond
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path d="M12 2.5L21.5 12L12 21.5L2.5 12L12 2.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7v10M7 12h10" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.2" className="fill-current" />
      <path d="M8.5 8.5l7 7M8.5 15.5l7-7" strokeWidth={0.8} strokeDasharray="1.5 1.5" />
    </svg>,
    // 3: Tech Grid/Square
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <rect x="7.5" y="7.5" width="9" height="9" rx="1" strokeDasharray="3 1.5" />
      <path d="M3.5 12h4M16.5 12h4M12 3.5v4M12 16.5v4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2" className="fill-current" />
    </svg>,
    // 4: Lightning Matrix
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path d="M13.5 2L4.5 13.5h7.5V22l9-11.5h-7.5L13.5 2Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 9l10 5" strokeWidth={1} strokeDasharray="2 2" />
      <circle cx="12" cy="12" r="1" className="fill-current" />
    </svg>,
    // 5: Trident/Psi Network
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path d="M12 2.5v19M4.5 8.5c0 6 15 6 15 0M8 12.5c0 4.5 8 4.5 8 0" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="5.5" r="1.5" className="fill-current" />
      <circle cx="12" cy="18.5" r="1.5" className="fill-current" />
    </svg>,
    // 6: Triple Node Linker
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <circle cx="12" cy="5.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <circle cx="18" cy="17.5" r="2.5" />
      <path d="M12 8v4.5M7.5 15L10 13M16.5 15L14 13" strokeLinecap="round" />
      <path d="M9.5 17.5h5" strokeDasharray="2 2" strokeLinecap="round" />
    </svg>
  ];
  return glyphs[index] || null;
}

function score(secret: number[], guess: number[]): Omit<Attempt, 'guess'> {
  let correct = 0;
  const secretCounts = new Map<number, number>();
  const guessCounts = new Map<number, number>();
  for (let i = 0; i < secret.length; i += 1) {
    if (secret[i] === guess[i]) {
      correct += 1;
    } else {
      secretCounts.set(secret[i], (secretCounts.get(secret[i]) ?? 0) + 1);
      guessCounts.set(guess[i], (guessCounts.get(guess[i]) ?? 0) + 1);
    }
  }
  let misplaced = 0;
  for (const [glyph, count] of guessCounts) {
    misplaced += Math.min(count, secretCounts.get(glyph) ?? 0);
  }
  return { correct, misplaced };
}

export function InjectionGame({
  params,
  onProgress,
  onResult,
}: MiniGameProps<InjectionParams, MiniGameProgress>) {
  const secret = useMemo(
    () =>
      Array.from(
        { length: params.sequenceLength },
        () => Math.floor(Math.random() * params.alphabetSize),
      ),
    [params.alphabetSize, params.sequenceLength],
  );
  const [guess, setGuess] = useState<number[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [finished, setFinished] = useState(false);

  const submit = () => {
    if (finished || guess.length !== params.sequenceLength) return;
    const result = score(secret, guess);
    const next = [...attempts, { guess, ...result }];
    const won = result.correct === params.sequenceLength;
    const exhausted = next.length >= params.maxAttempts;
    setAttempts(next);
    setGuess([]);
    onProgress({
      label: 'Essais',
      value: next.length,
      total: params.maxAttempts,
      detail: `${result.correct} placé(s), ${result.misplaced} ailleurs`,
    });
    if (won || exhausted) {
      setFinished(true);
      onResult(won);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3">
      {/* Barre de statut Cyberdeck */}
      <div className="flex items-center justify-between border border-grid bg-panel-2/50 px-3 py-1.5 text-[10px] tracking-wider text-ink-dim uppercase rounded-t">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_8px_var(--color-neon-cyan)]" />
          <span className="text-neon-cyan glow-text font-bold">CYBERDECK LINK ACTIVE // VIRUS INJECTOR</span>
        </div>
        <div className="flex gap-3 text-ink-dim">
          <span>ALPHABET: {params.alphabetSize}</span>
          <span>LONGUEUR: {params.sequenceLength}</span>
        </div>
      </div>

      {/* Terminal Readout - Liste des essais */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-grid bg-panel/60 p-3 shadow-inner relative">
        {/* Simulate grid interface */}
        <div className="absolute inset-0 bg-[radial-gradient(#1d2a38_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
        
        {attempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center h-full">
            <div className="text-neon-cyan/80 text-4xl mb-3">
              <svg className="w-12 h-12 mx-auto animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="glow-text tracking-widest text-neon-cyan uppercase text-xs font-bold">DIAGNOSTIC DE SÉQUENCE VIDE</p>
            <p className="text-[10px] text-ink-dim mt-2 max-w-sm leading-relaxed">
              Assemblez le payload de décryptage en utilisant l'alphabet de glyphes réseau. Injectez-le pour analyser le câblage de sécurité du nœud.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 relative z-10">
            {attempts.map((attempt, row) => (
              <div key={row} className="flex items-center gap-3 rounded border border-grid bg-panel-2/70 p-2.5 shadow-sm hover:border-neon-cyan-dim/40 transition-colors duration-150">
                <div className="text-[10px] font-bold text-ink-dim tracking-wider select-none w-14">
                  [#{row + 1}]
                </div>
                
                {/* Visualisation des glyphes devinés */}
                <div className="flex flex-1 justify-center gap-2.5">
                  {attempt.guess.map((glyph, i) => (
                    <div
                      key={i}
                      className="flex h-11 w-11 items-center justify-center rounded border border-grid bg-abyss text-neon-cyan shadow-[inset_0_0_6px_rgba(46,230,255,0.05)] transition-all duration-200"
                    >
                      <GlyphIcon index={glyph} className="w-7 h-7 text-neon-cyan glow-text" />
                    </div>
                  ))}
                </div>

                {/* Diagnostics Diodes LED */}
                <div className="flex flex-col items-end justify-center w-24 border-l border-grid pl-3 select-none">
                  {/* Correctly placed LEDs (Green) */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: params.sequenceLength }).map((_, i) => {
                      const isLit = i < attempt.correct;
                      return (
                        <span
                          key={i}
                          className={`h-2.5 w-2.5 rounded-full border transition-all duration-300 ${
                            isLit
                              ? 'border-neon-green bg-neon-green shadow-[0_0_8px_var(--color-neon-green)]'
                              : 'border-grid bg-transparent'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[8px] text-neon-green/70 tracking-wider font-bold mt-0.5">ALIGNÉ</span>
                  
                  {/* Misplaced LEDs (Magenta) */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {Array.from({ length: params.sequenceLength }).map((_, i) => {
                      const isLit = i < attempt.misplaced;
                      return (
                        <span
                          key={i}
                          className={`h-2.5 w-2.5 rounded-full border transition-all duration-300 ${
                            isLit
                              ? 'border-neon-magenta bg-neon-magenta shadow-[0_0_8px_var(--color-neon-magenta)]'
                              : 'border-grid bg-transparent'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[8px] text-neon-magenta/70 tracking-wider font-bold mt-0.5">DÉPLACÉ</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Console d'Entrée Joueur */}
      {!finished && (
        <div className="shrink-0 space-y-2 border border-grid bg-panel p-3 rounded-b shadow-[0_-5px_15px_rgba(0,0,0,0.2)]">
          
          {/* Séquence en cours de construction */}
          <div className="flex min-h-16 items-center justify-center gap-3 rounded border border-neon-cyan-dim/30 bg-neon-cyan/5 p-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-cyan/5 to-transparent pointer-events-none" />
            
            {Array.from({ length: params.sequenceLength }, (_, i) => {
              const hasValue = guess[i] !== undefined;
              return (
                <button
                  key={i}
                  className={`flex h-12 w-12 items-center justify-center rounded border transition-all duration-200 relative ${
                    hasValue
                      ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-[0_0_10px_rgba(46,230,255,0.15)]'
                      : 'border-grid bg-abyss text-ink-dim/40 hover:border-neon-cyan-dim/60'
                  }`}
                  onClick={() => setGuess((g) => g.filter((_, index) => index !== i))}
                >
                  {hasValue ? (
                    <GlyphIcon index={guess[i]} className="w-7 h-7 text-neon-cyan" />
                  ) : (
                    <span className="text-neon-cyan/30 animate-pulse font-mono">_</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Clavier d'Alphabet */}
          <div className="flex flex-col gap-2">
            <div className="text-[9px] tracking-wider text-ink-dim uppercase select-none">
              Sélectionnez les clés de modulation :
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: params.alphabetSize }).map((_, index) => {
                const disabled = guess.length >= params.sequenceLength;
                return (
                  <button
                    key={index}
                    disabled={disabled}
                    className={`btn h-14 flex items-center justify-center transition-all duration-150 ${
                      disabled
                        ? 'opacity-25 border-grid text-ink-dim/30 cursor-not-allowed'
                        : 'border-neon-magenta/40 text-neon-magenta bg-panel hover:border-neon-magenta hover:bg-neon-magenta/10 hover:shadow-[0_0_10px_rgba(255,46,196,0.15)]'
                    }`}
                    onClick={() => setGuess((g) => [...g, index])}
                  >
                    <GlyphIcon index={index} className="w-7 h-7" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contrôles globaux */}
          <div className="grid grid-cols-3 gap-2 mt-1">
            <button 
              className="btn border-grid text-ink-dim hover:border-neon-red/60 hover:text-neon-red hover:bg-neon-red/5 text-xs tracking-wider" 
              disabled={guess.length === 0} 
              onClick={() => setGuess([])}
            >
              EFFACER
            </button>
            
            <button
              className="btn btn-cyan font-bold tracking-widest text-xs col-span-2 hover:shadow-[0_0_12px_rgba(46,230,255,0.2)]"
              disabled={guess.length !== params.sequenceLength}
              onClick={submit}
            >
              INJECTER PAYLOAD
            </button>
          </div>
        </div>
      )}
      
      {/* Indicateur de fin de tentative */}
      <div className="flex justify-between items-center px-2 text-[10px] text-ink-dim select-none uppercase">
        <span>Sécurité du nœud active</span>
        <span className="text-neon-amber">Essais Restants : {params.maxAttempts - attempts.length}</span>
      </div>
    </div>
  );
}

