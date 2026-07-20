import { useEffect, useRef, useState } from 'react';
import { PERSONA } from '../../data/persona';
import { rechargeLuck } from '../../game/actions';
import { MINI_GAME_LABELS, resolveMiniGame } from '../../game/minigames';
import {
  MONITORS,
  dumpshock,
  endConvergence,
  nextTurn,
  reboot,
  setIntervention,
  setSurveillance,
  triggerConvergence,
} from '../../game/threat';
import { deckerDefaults, useNetworkStore } from '../../store/network';
import { clearMiniGame, setEnvironment, updateDecker } from '../../sync/write';
import type { EnvironmentState, ProgramState } from '../../types';
import { NumberField, SelectField, ToggleField } from './fields';

const NOISE_OPTIONS: Array<[string, string]> = [
  ['0', 'Nul (0)'],
  ['2', 'Faible (−2)'],
  ['3', 'Moyen (−3)'],
  ['4', 'Important (−4)'],
];
const DISTANCE_OPTIONS: Array<[string, string]> = [
  ['0', 'Courte (0)'],
  ['2', 'Moyenne (−2)'],
  ['4', 'Longue (−4)'],
];

/** Panneau MJ de pilotage : Surveillance/DIEU, tours, environnement, decker. */
export function GamePanel({ code }: { code: string }) {
  const { decker, environment, countdowns, lastRoll, minigame } = useNetworkStore();

  // Modal de complication : on capture l'action déclenchante pour que le modal
  // n'affiche pas les jets suivants s'ils arrivent pendant qu'il est ouvert.
  const [complication, setComplication] = useState<{ action: string } | null>(null);
  const lastProcessedComplicationTs = useRef<number | null>(null);

  // Un seul effet : armement à la première hydratation (le store est vide au
  // montage puis peuplé de façon asynchrone par Firebase — on mémorise le jet
  // existant sans ouvrir, pour ne pas rejouer une complication au rechargement),
  // puis ouverture sur tout NOUVEAU jet portant complication === 1.
  useEffect(() => {
    if (!lastRoll) return;
    if (lastProcessedComplicationTs.current === null) {
      lastProcessedComplicationTs.current = lastRoll.ts;
      return;
    }
    if (lastRoll.ts <= lastProcessedComplicationTs.current) return;
    lastProcessedComplicationTs.current = lastRoll.ts;
    if (lastRoll.complication === 1) setComplication({ action: lastRoll.action });
  }, [lastRoll]);

  const stun = decker.stun ?? deckerDefaults.stun;
  const physical = decker.physical ?? deckerDefaults.physical;
  const deckCondition = decker.deckCondition ?? deckerDefaults.deckCondition;
  const firewallPenalty = decker.firewallPenalty ?? deckerDefaults.firewallPenalty;
  const luck = decker.luck ?? deckerDefaults.luck;
  const surveillance = decker.surveillance ?? 0;
  const rebootCountdown = decker.rebootCountdown ?? 0;

  const systemBuff = environment.systemBuff ?? 0;
  const intervention = countdowns.intervention ?? null;
  const programs = decker.programs ?? {};
  const debuffs = decker.debuffs ?? {};

  const doConvergence = () => {
    const raw = window.prompt('Le DIEU converge — dégâts au deck (valeur MJ) :', '4');
    if (raw === null) return;
    void triggerConvergence(code, Math.max(0, Number(raw) || 0));
  };

  const toggleProgram = (id: 'marteau' | 'discretion') => {
    const next: ProgramState = (programs[id] ?? 'active') === 'active' ? 'crashed' : 'active';
    void updateDecker(code, { programs: { ...programs, [id]: next } });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* --- Surveillance / DIEU --- */}
      <h3 className="panel-title">Surveillance (DIEU)</h3>
      <div className="flex items-center gap-2">
        <button
          className="btn px-3 py-1"
          disabled={surveillance <= 0}
          onClick={() => void setSurveillance(code, surveillance - 1)}
        >
          −
        </button>
        <span
          className={`min-w-10 text-center text-lg ${
            surveillance >= 6 ? 'glow-text text-neon-red' : 'text-neon-amber'
          }`}
        >
          {surveillance}/6
        </span>
        <button
          className="btn px-3 py-1"
          disabled={surveillance >= 6}
          onClick={() => void setSurveillance(code, surveillance + 1)}
        >
          +
        </button>
      </div>
      {decker.convergence ? (
        <button className="btn btn-red text-xs" onClick={() => void endConvergence(code)}>
          Fin de la séquence DIEU
        </button>
      ) : (
        <button
          className="btn btn-red text-xs"
          disabled={surveillance < 6}
          onClick={doConvergence}
        >
          ☠ LE DIEU CONVERGE
        </button>
      )}

      {/* --- Tours --- */}
      <h3 className="panel-title mt-2">Tours</h3>
      <button className="btn btn-cyan text-xs" onClick={() => void nextTurn(code)}>
        ▶ Tour suivant
      </button>
      <p className="text-[10px] text-ink-dim">
        Reboot : {rebootCountdown > 0 ? `${rebootCountdown} tour(s)` : '—'} · Intervention :{' '}
        {intervention === null ? '—' : `${intervention} tour(s)`}
        {systemBuff > 0 && (
          <span className="text-neon-amber"> · buff système +{systemBuff}</span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-1">
        <button className="btn text-[11px]" onClick={() => void dumpshock(code)}>
          ⚡ Dumpshock
        </button>
        <button className="btn text-[11px]" onClick={() => void reboot(code, true)}>
          ⟳ Reboot forcé
        </button>
        <button
          className="btn text-[11px]"
          onClick={() => void setIntervention(code, 10)}
        >
          ⏱ Intervention 10
        </button>
        <button
          className="btn text-[11px]"
          disabled={intervention === null}
          onClick={() => void setIntervention(code, null)}
        >
          ⏱ Annuler
        </button>
      </div>

      {/* --- Environnement --- */}
      <h3 className="panel-title mt-2">Environnement</h3>
      <SelectField
        label="Bruit"
        value={String(environment.noise ?? 0)}
        options={NOISE_OPTIONS}
        onChange={(v) =>
          void setEnvironment(code, { noise: Number(v) as EnvironmentState['noise'] })
        }
      />
      <SelectField
        label="Distance wifi"
        value={String(environment.wifiDistance ?? 0)}
        options={DISTANCE_OPTIONS}
        onChange={(v) =>
          void setEnvironment(code, {
            wifiDistance: Number(v) as EnvironmentState['wifiDistance'],
          })
        }
      />

      {/* --- Decker --- */}
      <h3 className="panel-title mt-2">Decker</h3>
      <p className="text-xs text-ink-dim">
        🍀 {luck}/{PERSONA.chance}
        {decker.trapped && <span className="text-neon-red"> · PIÉGÉ</span>}
      </p>
      <NumberField
        label={`Deck (${deckCondition}/${MONITORS.deck})`}
        value={deckCondition}
        min={0}
        max={MONITORS.deck}
        onChange={(v) => void updateDecker(code, { deckCondition: v })}
      />
      <NumberField
        label="Étourdissant"
        value={stun}
        min={0}
        max={MONITORS.stun}
        onChange={(v) => void updateDecker(code, { stun: v })}
      />
      <NumberField
        label="Physique"
        value={physical}
        min={0}
        max={MONITORS.physical}
        onChange={(v) => void updateDecker(code, { physical: v })}
      />
      <NumberField
        label="Pénalité Firewall (Acide)"
        value={firewallPenalty}
        min={0}
        max={PERSONA.deck.firewall}
        onChange={(v) => void updateDecker(code, { firewallPenalty: v })}
      />
      <ToggleField
        label="Piégé (Pot de colle)"
        value={decker.trapped ?? false}
        onChange={(v) => void updateDecker(code, { trapped: v })}
      />
      <ToggleField
        label="Debuff Bloqueuse (−1 succès)"
        value={debuffs.bloqueuse ?? false}
        onChange={(v) => void updateDecker(code, { debuffs: { ...debuffs, bloqueuse: v } })}
      />
      <div className="grid grid-cols-2 gap-1">
        <button
          className={`btn text-[11px] ${(programs.marteau ?? 'active') === 'crashed' ? 'btn-red' : ''}`}
          onClick={() => toggleProgram('marteau')}
        >
          Marteau {(programs.marteau ?? 'active') === 'crashed' ? '✗' : '✓'}
        </button>
        <button
          className={`btn text-[11px] ${(programs.discretion ?? 'active') === 'crashed' ? 'btn-red' : ''}`}
          onClick={() => toggleProgram('discretion')}
        >
          Discrétion {(programs.discretion ?? 'active') === 'crashed' ? '✗' : '✓'}
        </button>
      </div>
      <button className="btn text-xs" onClick={() => void rechargeLuck(code)}>
        🍀 Recharger la Chance ({PERSONA.chance})
      </button>

      {/* --- Miroir mini-jeu --- */}
      <h3 className="panel-title mt-2">Mini-jeu</h3>
      {!minigame ? (
        <p className="text-[10px] text-ink-dim">— aucun mini-jeu —</p>
      ) : (
        <div className="rounded border border-neon-magenta/40 bg-panel-2 p-2 text-[11px] leading-5">
          <p className="text-neon-magenta">{MINI_GAME_LABELS[minigame.kind]}</p>
          <p className="truncate text-ink-dim" title={minigame.action}>
            {minigame.action}
          </p>
          <p>
            {minigame.progress.label} : {minigame.progress.value}/{minigame.progress.total}
          </p>
          {minigame.progress.detail && (
            <p className="text-ink-dim">{minigame.progress.detail}</p>
          )}
          <p
            className={
              minigame.status === 'success'
                ? 'text-neon-green'
                : minigame.status === 'failure'
                  ? 'text-neon-red'
                  : 'pulse-slow text-neon-cyan'
            }
          >
            {minigame.status === 'active'
              ? 'EN COURS'
              : minigame.status === 'success'
                ? 'RÉUSSI'
                : 'ÉCHOUÉ'}
          </p>
          {minigame.status === 'active' ? (
            <div className="mt-1 grid grid-cols-2 gap-1">
              <button
                className="btn btn-cyan text-[10px]"
                onClick={() => void resolveMiniGame(code, minigame, true)}
              >
                Passer · réussite
              </button>
              <button
                className="btn btn-red text-[10px]"
                onClick={() => void resolveMiniGame(code, minigame, false)}
              >
                Forcer l'échec
              </button>
            </div>
          ) : (
            <button
              className="btn mt-1 w-full text-[10px]"
              onClick={() => void clearMiniGame(code)}
            >
              Archiver le résultat
            </button>
          )}
        </div>
      )}

      {/* --- Dernier jet --- */}
      <h3 className="panel-title mt-2">Dernier jet</h3>
      {!lastRoll ? (
        <p className="text-[10px] text-ink-dim">— aucun jet —</p>
      ) : (
        <div className="rounded border border-grid bg-panel-2 p-2 text-[11px] leading-5">
          <p className="text-neon-cyan">{lastRoll.action}</p>
          <div className="my-1 flex flex-wrap gap-1">
            {lastRoll.dice.map((d, i) => (
              <span
                key={i}
                className={
                  'flex h-5 w-5 items-center justify-center rounded border text-[10px] ' +
                  (d >= lastRoll.successOn
                    ? 'border-neon-cyan text-neon-cyan'
                    : 'border-grid text-ink-dim')
                }
              >
                {d}
              </span>
            ))}
          </div>
          <p>
            {lastRoll.successes} succès ({lastRoll.pool}D, {lastRoll.successOn}+)
            {lastRoll.luckUsed ? ' · 🍀 Chance' : ''}
            {lastRoll.rerolled ? ' · ↻ relance' : ''}
          </p>
          <p className="text-ink-dim">{lastRoll.outcome}</p>
          {lastRoll.complication > 0 && (
            <p className={lastRoll.complication === 1 ? 'glow-text text-neon-red' : 'text-ink-dim'}>
              Dé de complication : {lastRoll.complication}
              {lastRoll.complication === 1 ? ' — ⚠ COMPLICATION' : ''}
            </p>
          )}
          <details className="mt-1">
            <summary className="cursor-pointer text-[10px] text-ink-dim">
              Détail de la réserve
            </summary>
            {lastRoll.lines.map((l, i) => (
              <p key={i} className="text-[10px] text-ink-dim">
                {l.label} : {l.value >= 0 ? `+${l.value}` : l.value}D
              </p>
            ))}
          </details>
        </div>
      )}

      {/* Modal de complication */}
      {complication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-abyss/85 text-ink">
          <div className="relative w-full max-w-sm rounded border border-neon-red bg-panel p-5 shadow-[0_0_25px_rgba(255,59,92,0.5)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-neon-red font-bold text-sm tracking-wider uppercase">
                ⚠ COMPLICATION MATRICIELLE
              </span>
            </div>
            <div className="h-px bg-neon-red/30 my-2" />
            <p className="text-xs text-ink leading-5 mb-2">
              Le Decker a obtenu un <span className="text-neon-red font-bold">1</span> sur son dé de complication lors de l'action :
            </p>
            <p className="text-xs text-neon-cyan font-bold bg-panel-2 p-2 rounded mb-4 truncate" title={complication.action}>
              {complication.action}
            </p>
            <p className="text-xs text-ink mb-4">
              Voulez-vous lui infliger +1 point de Surveillance ?
            </p>
            <div className="flex flex-col gap-2">
              <button
                className="btn btn-red py-2 text-xs font-bold uppercase tracking-wider pulse-slow"
                disabled={surveillance >= 6}
                onClick={() => {
                  void setSurveillance(code, surveillance + 1);
                  setComplication(null);
                }}
              >
                Infliger +1 Surveillance ({surveillance} ➔ {Math.min(6, surveillance + 1)}/6)
              </button>
              <button
                className="btn py-2 text-xs font-semibold uppercase tracking-wider"
                onClick={() => setComplication(null)}
              >
                Ignorer la complication
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
