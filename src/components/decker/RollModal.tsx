import { useState } from 'react';
import { PERSONA } from '../../data/persona';
import { countSuccesses, rerollFailures, rollD6, rollDice } from '../../game/dice';
import { poolTotal } from '../../game/pools';
import { publishRollAndLog, spendLuck } from '../../game/actions';
import { deckerDefaults, useNetworkStore } from '../../store/network';
import type { PoolLine, RollRecord } from '../../types';

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
  const [lines, setLines] = useState<PoolLine[]>(request.lines);
  const [luckOn, setLuckOn] = useState(false);
  const [dice, setDice] = useState<number[] | null>(null);
  const [complication, setComplication] = useState(0);
  const [rerolled, setRerolled] = useState(false);
  const [busy, setBusy] = useState(false);

  const pool = poolTotal(lines);
  const successOn: 4 | 5 = luckOn ? 4 : 5;
  const penalty = request.successPenalty ?? 0;
  const successes = dice ? Math.max(0, countSuccesses(dice, successOn) - penalty) : 0;

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
            <button
              className="btn btn-cyan py-3 text-sm"
              disabled={busy}
              onClick={() => void doValidate()}
            >
              {busy ? '…' : 'Valider le résultat'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
