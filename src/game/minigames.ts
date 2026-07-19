import { applyHack, readPaydata } from './actions';
import { applyEscape } from './threat';
import { useNetworkStore } from '../store/network';
import { appendLog, publishMiniGame, updateDecker, updateMiniGame } from '../sync/write';
import type {
  DecryptionParams,
  ExtractionParams,
  InjectionParams,
  JammingParams,
  MiniGameContext,
  MiniGameKind,
  MiniGameParams,
  MiniGameState,
  OverloadParams,
} from '../types';

export const MINI_GAME_LABELS: Record<MiniGameKind, string> = {
  injection: 'Injection de code',
  overload: 'Surcharge',
  decryption: 'Décryptage',
  extraction: 'Extraction d’urgence',
  jamming: 'Brouillage',
};

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
  if (successes >= 4) return { gridSize: 4, timeLimit: 40 };
  if (successes >= 2) return { gridSize: 5, timeLimit: 34 };
  if (successes === 1) return { gridSize: 5, timeLimit: 26 };
  return { gridSize: 6, timeLimit: 20 };
}

export function extractionParams(successes: number): ExtractionParams {
  if (successes >= 4) return { gridSize: 8, timeLimit: 25 };
  if (successes >= 2) return { gridSize: 10, timeLimit: 21 };
  if (successes === 1) return { gridSize: 12, timeLimit: 17 };
  return { gridSize: 14, timeLimit: 12 };
}

export function jammingParams(successes: number): JammingParams {
  if (successes >= 4) return { duration: 12, spawnInterval: 950, maxMisses: 3 };
  if (successes >= 2) return { duration: 14, spawnInterval: 800, maxMisses: 3 };
  if (successes === 1) return { duration: 16, spawnInterval: 650, maxMisses: 2 };
  return { duration: 18, spawnInterval: 520, maxMisses: 1 };
}

function paramsFor(kind: MiniGameKind, successes: number): MiniGameParams {
  switch (kind) {
    case 'injection': return injectionParams(successes);
    case 'overload': return overloadParams(successes);
    case 'decryption': return decryptionParams(successes);
    case 'extraction': return extractionParams(successes);
    case 'jamming': return jammingParams(successes);
  }
}

function totalFor(kind: MiniGameKind, params: MiniGameParams): number {
  if (kind === 'injection') return (params as InjectionParams).maxAttempts;
  if (kind === 'overload') return (params as OverloadParams).requiredHits;
  if (kind === 'decryption') return (params as DecryptionParams).gridSize ** 2;
  if (kind === 'extraction') return (params as ExtractionParams).gridSize ** 2;
  return (params as JammingParams).duration;
}

export function createMiniGame(
  action: string,
  kind: MiniGameKind,
  context: MiniGameContext,
): MiniGameState {
  const params = paramsFor(kind, context.rollSuccesses);
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

export async function applyPaydataDecrypt(
  code: string,
  nodeId: string,
  successes: number,
): Promise<string> {
  if (successes < 1) return 'échec — chiffrement intact';
  const paydata = await readPaydata(code, nodeId);
  return paydata ? `PAYDATA : ${paydata}` : 'aucune paydata exploitable';
}

export async function applyTraceJamming(code: string, successes: number): Promise<string> {
  const decker = useNetworkStore.getState().decker;
  if (successes < 1) {
    const surveillance = Math.min(3, (decker.surveillance ?? 0) + 1);
    await updateDecker(code, { surveillance });
    await appendLog(code, 'alert', 'Brouillage échoué : +1 Surveillance.');
    return 'échec — la trace se resserre (+1 Surveillance)';
  }
  const turns = Math.max(2, successes + 1);
  await updateDecker(code, { traceDelay: turns });
  await appendLog(code, 'action', `Trace brouillée : localisation retardée de ${turns} tour(s).`);
  return `trace retardée de ${turns} tour(s)`;
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
    case 'paydata':
      outcome = await applyPaydataDecrypt(code, game.context.nodeId, won ? Math.max(1, successes) : 0);
      break;
    case 'escape':
      outcome = await applyEscape(code, successes);
      break;
    case 'trace':
      outcome = await applyTraceJamming(code, won ? Math.max(1, successes) : 0);
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
