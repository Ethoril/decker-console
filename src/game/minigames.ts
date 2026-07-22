import { applyHack } from './actions';
import { applyEscape } from './threat';
import { appendLog, publishMiniGame, updateMiniGame } from '../sync/write';
import type {
  DecryptionParams,
  ExtractionParams,
  InjectionParams,
  MiniGameContext,
  MiniGameKind,
  MiniGameParams,
  MiniGameState,
  OverloadParams,
  SequenceParams,
} from '../types';

export const MINI_GAME_LABELS: Record<MiniGameKind, string> = {
  injection: 'Injection de code',
  overload: 'Surcharge',
  decryption: 'Décryptage',
  extraction: 'Extraction d’urgence',
  sequence: 'Matrice de Séquençage',
};

/** Sélection auto : tirage uniforme parmi tous les mini-jeux (20 % chacun),
 *  indépendant du type d'action. Le mini-jeu forcé par le MJ reste prioritaire. */
export function pickMiniGameKind(): MiniGameKind {
  const allKinds: MiniGameKind[] = ['injection', 'overload', 'decryption', 'extraction', 'sequence'];
  return allKinds[Math.floor(Math.random() * allKinds.length)];
}

export function injectionParams(successes: number): InjectionParams {
  if (successes >= 4) return { sequenceLength: 3, alphabetSize: 5, maxAttempts: 6 };
  if (successes >= 2) return { sequenceLength: 4, alphabetSize: 6, maxAttempts: 6 };
  if (successes === 1) return { sequenceLength: 4, alphabetSize: 6, maxAttempts: 5 };
  return { sequenceLength: 5, alphabetSize: 7, maxAttempts: 5 };
}

export function overloadParams(successes: number): OverloadParams {
  if (successes >= 4) return { zoneWidth: 0.32, speed: 0.72, requiredHits: 3 };
  if (successes >= 2) return { zoneWidth: 0.24, speed: 0.9, requiredHits: 3 };
  if (successes === 1) return { zoneWidth: 0.17, speed: 1.08, requiredHits: 4 };
  return { zoneWidth: 0.12, speed: 1.28, requiredHits: 4 };
}

export function decryptionParams(successes: number): DecryptionParams {
  if (successes >= 4) return { gridSize: 5, timeLimit: 35 };
  if (successes >= 2) return { gridSize: 6, timeLimit: 30 };
  if (successes === 1) return { gridSize: 6, timeLimit: 24 };
  return { gridSize: 7, timeLimit: 22 };
}

export function extractionParams(successes: number): ExtractionParams {
  if (successes >= 4) return { gridSize: 7, timeLimit: 25 };
  if (successes >= 2) return { gridSize: 8, timeLimit: 22 };
  if (successes === 1) return { gridSize: 9, timeLimit: 20 };
  return { gridSize: 10, timeLimit: 18 };
}

export function sequenceParams(successes: number): SequenceParams {
  if (successes >= 4) return { gridSize: 3, sequenceLength: 4, displaySpeedMs: 550, maxErrors: 2 };
  if (successes >= 2) return { gridSize: 3, sequenceLength: 5, displaySpeedMs: 450, maxErrors: 1 };
  if (successes === 1) return { gridSize: 4, sequenceLength: 6, displaySpeedMs: 380, maxErrors: 1 };
  return { gridSize: 4, sequenceLength: 7, displaySpeedMs: 300, maxErrors: 0 };
}

function paramsFor(kind: MiniGameKind, successes: number): MiniGameParams {
  switch (kind) {
    case 'injection': return injectionParams(successes);
    case 'overload': return overloadParams(successes);
    case 'decryption': return decryptionParams(successes);
    case 'extraction': return extractionParams(successes);
    case 'sequence': return sequenceParams(successes);
  }
}

function totalFor(kind: MiniGameKind, params: MiniGameParams): number {
  if (kind === 'injection') return (params as InjectionParams).maxAttempts;
  if (kind === 'overload') return (params as OverloadParams).requiredHits;
  if (kind === 'decryption') return (params as DecryptionParams).gridSize ** 2;
  if (kind === 'extraction') return (params as ExtractionParams).gridSize ** 2;
  return (params as SequenceParams).sequenceLength;
}

export function createMiniGame(
  action: string,
  kind: MiniGameKind,
  context: MiniGameContext,
  difficultySuccesses = context.rollSuccesses,
): MiniGameState {
  const params = paramsFor(kind, difficultySuccesses);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    status: 'active',
    action,
    startedAt: Date.now(),
    params,
    progress: { label: 'Initialisation', value: 0, total: totalFor(kind, params) },
    context,
  };
}

export async function startMiniGame(code: string, game: MiniGameState): Promise<void> {
  await publishMiniGame(code, game);
  await appendLog(code, 'action', `Mini-jeu lancé : ${MINI_GAME_LABELS[game.kind]} — ${game.action}.`);
}

/** Applique l'effet métier du mini-jeu, puis publie son résultat au miroir MJ. */
export async function resolveMiniGame(
  code: string,
  game: MiniGameState,
  won: boolean,
): Promise<string> {
  if (game.status !== 'active') return 'mini-jeu déjà résolu';
  const successes = won ? Math.max(2, game.context.rollSuccesses) : 0;
  let outcome: string;

  switch (game.context.type) {
    case 'hack':
      outcome = await applyHack(
        code,
        game.context.nodeId,
        game.context.approach,
        successes,
      );
      break;
    case 'escape':
      outcome = await applyEscape(code, successes);
      break;
  }

  await updateMiniGame(code, {
    status: won ? 'success' : 'failure',
    completedAt: Date.now(),
  });
  await appendLog(
    code,
    won ? 'action' : 'alert',
    `${MINI_GAME_LABELS[game.kind]} ${won ? 'réussi' : 'échoué'} — ${outcome}.`,
  );
  return outcome;
}
