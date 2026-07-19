import { useMemo, useState } from 'react';
import type { InjectionParams, MiniGameProgress } from '../../types';
import type { MiniGameProps } from '../types';

const GLYPHS = ['△', '○', '◇', '□', '⌁', 'ϟ', 'Ψ'];

interface Attempt {
  guess: number[];
  correct: number;
  misplaced: number;
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
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-dim">
          Séquence {params.sequenceLength} glyphes · alphabet {params.alphabetSize}
        </span>
        <span className="text-neon-amber">
          Essais {attempts.length}/{params.maxAttempts}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-grid bg-panel/60 p-2">
        {attempts.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink-dim">
            Composez la séquence. Cyan = bien placé, magenta = présent ailleurs.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {attempts.map((attempt, row) => (
              <div key={row} className="flex items-center gap-3 rounded bg-panel-2 p-2">
                <div className="flex flex-1 justify-center gap-2">
                  {attempt.guess.map((glyph, i) => (
                    <span
                      key={i}
                      className="flex h-10 w-10 items-center justify-center rounded border border-grid text-xl"
                    >
                      {GLYPHS[glyph]}
                    </span>
                  ))}
                </div>
                <div className="w-24 text-[11px]">
                  <p className="text-neon-cyan">● {attempt.correct} placé(s)</p>
                  <p className="text-neon-magenta">● {attempt.misplaced} ailleurs</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!finished && (
        <div className="shrink-0 space-y-2">
          <div className="flex min-h-14 items-center justify-center gap-2 rounded border border-neon-cyan-dim bg-neon-cyan/5 p-2">
            {Array.from({ length: params.sequenceLength }, (_, i) => (
              <button
                key={i}
                className="flex h-11 w-11 items-center justify-center rounded border border-grid text-xl"
                onClick={() => setGuess((g) => g.filter((_, index) => index !== i))}
              >
                {guess[i] === undefined ? '·' : GLYPHS[guess[i]]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {GLYPHS.slice(0, params.alphabetSize).map((glyph, index) => (
              <button
                key={glyph}
                className="btn btn-magenta px-1 text-xl"
                disabled={guess.length >= params.sequenceLength}
                onClick={() => setGuess((g) => [...g, index])}
              >
                {glyph}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" disabled={guess.length === 0} onClick={() => setGuess([])}>
              Effacer
            </button>
            <button
              className="btn btn-cyan"
              disabled={guess.length !== params.sequenceLength}
              onClick={submit}
            >
              Injecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
