import { PERSONA } from '../../data/persona';
import { MODE_LABELS, rechargeLuck } from '../../game/actions';
import { deckerDefaults, useNetworkStore } from '../../store/network';
import { setEnvironment, updateDecker } from '../../sync/write';
import type { EnvironmentState } from '../../types';
import { NumberField, SelectField } from './fields';

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

/** Panneau MJ de pilotage Phase 2 : environnement, jauges decker, dernier jet. */
export function GamePanel({ code }: { code: string }) {
  const { decker, environment, lastRoll } = useNetworkStore();
  const stun = decker.stun ?? deckerDefaults.stun;
  const physical = decker.physical ?? deckerDefaults.physical;
  const luck = decker.luck ?? deckerDefaults.luck;

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="panel-title">Environnement</h3>
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

      <h3 className="panel-title mt-2">Decker</h3>
      <p className="text-xs text-ink-dim">
        Mode : <span className="text-neon-cyan">{MODE_LABELS[decker.mode ?? 'AR']}</span> · 🍀{' '}
        {luck}/{PERSONA.chance}
      </p>
      <NumberField
        label="Étourdissant"
        value={stun}
        min={0}
        max={20}
        onChange={(v) => void updateDecker(code, { stun: v })}
      />
      <NumberField
        label="Physique"
        value={physical}
        min={0}
        max={20}
        onChange={(v) => void updateDecker(code, { physical: v })}
      />
      <button className="btn text-xs" onClick={() => void rechargeLuck(code)}>
        🍀 Recharger la Chance ({PERSONA.chance})
      </button>

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
              {lastRoll.complication === 1 ? ' — ⚠ COMPLICATION (+1 Surveillance ?)' : ''}
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
    </div>
  );
}
