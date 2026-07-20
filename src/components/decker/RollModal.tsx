import { useCallback, useEffect, useState } from 'react';
import { PERSONA } from '../../data/persona';
import { countSuccesses, rerollFailures, rollD6, rollDice } from '../../game/dice';
import { poolTotal } from '../../game/pools';
import { publishRollAndLog, spendLuck } from '../../game/actions';
import {
  MINI_GAME_LABELS,
  createMiniGame,
  pickMiniGameKind,
  resolveMiniGame,
  startMiniGame,
} from '../../game/minigames';
import { applyMatrixDamage } from '../../game/threat';
import { deckerDefaults, useNetworkStore } from '../../store/network';
import { updateMiniGame } from '../../sync/write';
import type {
  DecryptionParams,
  ExtractionParams,
  InjectionParams,
  MiniGameContext,
  MiniGameKind,
  MiniGameRequestContext,
  MiniGameState,
  OverloadParams,
  PoolLine,
  RollRecord,
} from '../../types';
import { InjectionGame } from '../../minigames/injection/InjectionGame';
import { MiniGameShell } from '../../minigames/MiniGameShell';
import { OverloadGame } from '../../minigames/overload/OverloadGame';
import { DecryptionGame } from '../../minigames/decryption/DecryptionGame';
import { ExtractionGame } from '../../minigames/extraction/ExtractionGame';

export interface RollRequest {
  /** Libellé du test, ex. « Hack (Corruption) — Serveur RH ». */
  action: string;
  /** Réserve composée par l'appelant (chaque ligne désactivable ici). */
  lines: PoolLine[];
  /** true pour les tests de Hacking : lance le dé de complication (MJ). */
  withComplication: boolean;
  /** Succès ignorés (GLACE Bloqueuse : « ignorer 1 succès »). */
  successPenalty?: number;
  /** Applique l'effet du jet et retourne le résumé (outcome). */
  apply: (successes: number) => Promise<string>;
  miniGame?: { kind: MiniGameKind; context: MiniGameRequestContext };
  /** Identifiant du nœud cible pour proposer le déplacement après réussite. */
  hackTargetId?: string;
  /** Marks du nœud avant le hack — sert à ne proposer le déplacement que sur un gain réel d'accès. */
  hackMarksBefore?: number;
  /** Mini-jeu imposé par le MJ sur le nœud cible ; court-circuite pickMiniGameKind. */
  forcedMinigame?: MiniGameKind | null;
}

type AutomaticResolution =
  | { type: 'direct'; label: string }
  | { type: 'minigame'; label: string; difficultySuccesses: number };

function automaticResolution(successes: number): AutomaticResolution {
  if (successes >= 5) return { type: 'direct', label: 'Réussite forte — effet immédiat' };
  if (successes >= 3) return { type: 'minigame', label: 'Réussite moyenne — séquence simple', difficultySuccesses: 4 };
  if (successes === 2) return { type: 'minigame', label: 'Réussite faible — séquence moyenne', difficultySuccesses: 2 };
  if (successes === 1) return { type: 'minigame', label: 'Petit échec — séquence difficile', difficultySuccesses: 0 };
  return { type: 'direct', label: 'Échec important — conséquence immédiate' };
}

/**
 * Écran de jet (CDC §4.2) : composition de la réserve ligne à ligne,
 * toggle Chance 🍀 (succès sur 4+), lancer, relance Cyber-5, publication.
 */
export function RollModal({
  code,
  request,
  onClose,
}: {
  code: string;
  request: RollRequest;
  onClose: () => void;
}) {
  const luck = useNetworkStore((s) => s.decker.luck ?? deckerDefaults.luck);
  const remoteGame = useNetworkStore((s) => s.minigame);
  const [lines, setLines] = useState<PoolLine[]>(request.lines);
  const [luckOn, setLuckOn] = useState(false);
  const [dice, setDice] = useState<number[] | null>(null);
  const [complication, setComplication] = useState(0);
  const [rerolled, setRerolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeGame, setActiveGame] = useState<MiniGameState | null>(null);
  const [miniOutcome, setMiniOutcome] = useState<{ won: boolean; text: string } | null>(null);

  useEffect(() => {
    if (
      activeGame &&
      remoteGame?.id === activeGame.id &&
      remoteGame.status !== 'active' &&
      !miniOutcome
    ) {
      setMiniOutcome({
        won: remoteGame.status === 'success',
        text: 'Résolution appliquée par le MJ.',
      });
    }
  }, [activeGame, miniOutcome, remoteGame]);

  const pool = poolTotal(lines);
  const successOn: 4 | 5 = luckOn ? 4 : 5;
  const penalty = request.successPenalty ?? 0;
  const successes = dice ? Math.max(0, countSuccesses(dice, successOn) - penalty) : 0;
  const resolution = automaticResolution(successes);

  const toggleLine = (id: string) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l)));

  const doRoll = () => {
    if (pool < 1) return;
    if (luckOn) void spendLuck(code);
    setDice(rollDice(pool));
    setComplication(request.withComplication ? rollD6() : 0);
  };

  const doReroll = () => {
    if (!dice || rerolled) return;
    setDice(rerollFailures(dice, successOn));
    setRerolled(true);
  };

  const doValidate = async () => {
    if (!dice || busy) return;
    setBusy(true);
    try {
      const outcome = await request.apply(successes);
      const record: RollRecord = {
        ts: Date.now(),
        action: request.action,
        lines: lines.filter((l) => l.enabled).map(({ label, value }) => ({ label, value })),
        pool,
        dice,
        successes,
        successOn,
        luckUsed: luckOn,
        rerolled,
        complication,
        outcome,
      };
      await publishRollAndLog(code, record);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const doStartMiniGame = async (difficultySuccesses: number) => {
    if (!dice || busy || !request.miniGame) return;
    setBusy(true);
    try {
      const context = {
        ...request.miniGame.context,
        rollSuccesses: successes,
      } as MiniGameContext;
      const kind = request.forcedMinigame ?? pickMiniGameKind(request.miniGame.kind);
      const game = createMiniGame(request.action, kind, context, difficultySuccesses);
      const record: RollRecord = {
        ts: Date.now(),
        action: request.action,
        lines: lines.filter((l) => l.enabled).map(({ label, value }) => ({ label, value })),
        pool,
        dice,
        successes,
        successOn,
        luckUsed: luckOn,
        rerolled,
        complication,
        outcome: `${MINI_GAME_LABELS[game.kind]} lancé — résolution en cours`,
      };
      await publishRollAndLog(code, record);
      await startMiniGame(code, game);
      setActiveGame(game);
    } finally {
      setBusy(false);
    }
  };

  const doAutomaticResolution = () => {
    if (resolution.type === 'direct') void doValidate();
    else void doStartMiniGame(resolution.difficultySuccesses);
  };

  const finishMiniGame = useCallback(async (won: boolean) => {
    if (!activeGame || miniOutcome) return;
    setBusy(true);
    try {
      const text = await resolveMiniGame(code, activeGame, won);
      setMiniOutcome({ won, text });
    } finally {
      setBusy(false);
    }
  }, [activeGame, code, miniOutcome]);

  const reportProgress = useCallback(
    (progress: MiniGameState['progress']) => void updateMiniGame(code, { progress }),
    [code],
  );
  const reportResult = useCallback(
    (won: boolean) => void finishMiniGame(won),
    [finishMiniGame],
  );

  if (activeGame) {
    const common = {
      onProgress: reportProgress,
      onResult: reportResult,
    };
    let gameView;
    switch (activeGame.kind) {
      case 'injection':
        gameView = <InjectionGame params={activeGame.params as InjectionParams} {...common} />;
        break;
      case 'overload':
        gameView = (
          <OverloadGame
            params={activeGame.params as OverloadParams}
            {...common}
            onMiss={() => void applyMatrixDamage(code, 1, 'Surcharge instable')}
          />
        );
        break;
      case 'decryption':
        gameView = <DecryptionGame params={activeGame.params as DecryptionParams} {...common} />;
        break;
      case 'extraction':
        gameView = <ExtractionGame params={activeGame.params as ExtractionParams} {...common} />;
        break;
    }
    return (
      <MiniGameShell
        title={MINI_GAME_LABELS[activeGame.kind]}
        subtitle={`${request.action} · difficulté issue du jet : ${successes} succès`}
      >
        {gameView}
        {miniOutcome && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-abyss/85 p-4">
            <div
              className={`w-full max-w-sm rounded border bg-panel p-5 text-center ${
                miniOutcome.won ? 'border-neon-green' : 'border-neon-red'
              }`}
            >
              <p
                className={`glow-text mb-2 text-xl ${
                  miniOutcome.won ? 'text-neon-green' : 'text-neon-red'
                }`}
              >
                {miniOutcome.won ? 'SÉQUENCE RÉUSSIE' : 'SÉQUENCE REJETÉE'}
              </p>
              <p className="mb-4 text-xs text-ink-dim">{miniOutcome.text}</p>
              <button className="btn btn-cyan w-full" onClick={onClose}>
                Retour à la carte
              </button>
            </div>
          </div>
        )}
      </MiniGameShell>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-abyss/85" />
      <div className="relative z-10 flex max-h-full w-full max-w-md flex-col gap-2 overflow-y-auto rounded border border-grid bg-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="panel-title mb-0">{request.action}</h2>
          {!dice && (
            <button className="btn px-2 py-0.5 text-xs" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {/* Composeur de réserve */}
        {!dice && (
          <>
            <div className="flex flex-col gap-1">
              {lines.map((l) => (
                <button
                  key={l.id}
                  className={`btn flex items-center justify-between px-2 py-1 text-xs ${
                    l.enabled ? '' : 'opacity-40'
                  }`}
                  onClick={() => toggleLine(l.id)}
                >
                  <span>
                    {l.enabled ? '◉' : '○'} {l.label}
                  </span>
                  <span className={l.value >= 0 ? 'text-neon-green' : 'text-neon-red'}>
                    {l.value >= 0 ? `+${l.value}` : l.value}D
                  </span>
                </button>
              ))}
            </div>
            <button
              className={`btn text-xs ${luckOn ? 'btn-cyan active' : ''}`}
              aria-pressed={luckOn}
              disabled={luck < 1 && !luckOn}
              onClick={() => setLuckOn((v) => !v)}
            >
              🍀 Chance : succès sur 4+ ({luck} restant{luck > 1 ? 's' : ''})
            </button>
            <button
              className="btn btn-cyan py-3 text-sm"
              disabled={pool < 1}
              onClick={doRoll}
            >
              Lancer {pool}D — succès sur {successOn}+
            </button>
          </>
        )}

        {/* Résultat */}
        {dice && (
          <>
            <div className="flex flex-wrap justify-center gap-1.5 py-2">
              {dice.map((d, i) => (
                <span
                  key={i}
                  className={
                    'flex h-9 w-9 items-center justify-center rounded border text-base ' +
                    (d >= successOn
                      ? 'glow-text border-neon-cyan text-neon-cyan'
                      : 'border-grid text-ink-dim')
                  }
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="text-center text-sm">
              <span className="glow-text text-xl text-neon-green">{successes}</span>{' '}
              succès sur {pool}D ({successOn}+)
            </p>
            {penalty > 0 && (
              <p className="text-center text-[10px] text-neon-red">
                Bloqueuse : {penalty} succès ignoré{penalty > 1 ? 's' : ''}
              </p>
            )}
            <button
              className="btn text-xs"
              disabled={rerolled || busy}
              onClick={doReroll}
            >
              ↻ Relancer les échecs — {PERSONA.deck.name}{' '}
              {rerolled ? '(utilisée)' : '(1×/test)'}
            </button>
            {request.miniGame ? (
              <div className="flex flex-col gap-2">
                <p className={`text-center text-[11px] ${resolution.type === 'direct' ? 'text-neon-cyan' : 'text-neon-magenta'}`}>
                  {resolution.label}
                  {request.forcedMinigame && resolution.type === 'minigame' && ` (Mini-jeu forcé : ${MINI_GAME_LABELS[request.forcedMinigame]})`}
                </p>
                <button
                  className={`btn py-3 text-xs ${resolution.type === 'minigame' ? 'btn-magenta' : 'btn-cyan'}`}
                  disabled={busy}
                  onClick={doAutomaticResolution}
                >
                  {resolution.type === 'direct' ? 'Appliquer le résultat' : 'Lancer la séquence'}
                </button>
              </div>
            ) : (
              <button
                className="btn btn-cyan py-3 text-sm"
                disabled={busy}
                onClick={() => void doValidate()}
              >
                {busy ? '…' : 'Valider le résultat'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
