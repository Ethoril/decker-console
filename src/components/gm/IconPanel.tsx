import { useState } from 'react';
import { ICE_LABELS } from '../map/shapes';
import { ICE_EFFECTS, ICE_STATS } from '../../data/ice';
import { iconAttack } from '../../game/threat';
import { deleteIcon, updateIcon } from '../../sync/write';
import type { IceType, IconKind, MatrixIcon } from '../../types';
import { CommitField, NumberField, SelectField, ToggleField } from './fields';

const KIND_LABELS: Record<IconKind, string> = {
  ice: 'GLACE',
  spider: 'Spider',
  enemyHacker: 'Hacker ennemi',
};

export function IconPanel({
  code,
  iconId,
  icon,
  mode,
  onDeleted,
}: {
  code: string;
  iconId: string;
  icon: MatrixIcon;
  mode: 'edit' | 'game';
  onDeleted: () => void;
}) {
  const patch = (partial: Partial<MatrixIcon>) => void updateIcon(code, iconId, partial);
  const [attackResult, setAttackResult] = useState<string | null>(null);
  const effect = icon.kind === 'ice' && icon.iceType ? ICE_EFFECTS[icon.iceType] : null;

  const doAttack = async () => {
    setAttackResult('…');
    setAttackResult(await iconAttack(code, iconId));
  };

  return (
    <div>
      <h3 className="panel-title">{KIND_LABELS[icon.kind]}</h3>

      {mode === 'edit' && (
        <>
          <CommitField label="Label" value={icon.label} onCommit={(v) => patch({ label: v })} />
          {icon.kind === 'ice' && (
            <>
              <SelectField
                label="Type de GLACE"
                value={icon.iceType ?? ''}
                options={[
                  ['', '— non défini —'],
                  ...(Object.entries(ICE_LABELS) as Array<[IceType, string]>),
                ]}
                onChange={(v) => patch({ iceType: (v || null) as IceType | null })}
              />
              {icon.iceType && (
                <div className="mt-1 mb-2 rounded border border-grid bg-panel-2 p-2 text-[10px] leading-4 text-ink-dim">
                  <p>
                    FW {ICE_STATS.firewall} · Log {ICE_STATS.logique} · attaque{' '}
                    {ICE_STATS.attackPool}D{effect?.attackBonus ? `+${effect.attackBonus}` : ''} ·
                    dégâts {ICE_STATS.baseDamage}+nets
                  </p>
                  {effect?.onHitText && <p className="text-neon-red">Impact : {effect.onHitText}</p>}
                  {effect?.passiveText && <p>{effect.passiveText}</p>}
                </div>
              )}
            </>
          )}
          <NumberField
            label="Condition"
            value={icon.condition}
            min={0}
            max={12}
            onChange={(condition) => patch({ condition })}
          />
        </>
      )}

      <ToggleField
        label="Visible du joueur"
        value={icon.visibleToPlayer}
        onChange={(visibleToPlayer) => patch({ visibleToPlayer })}
      />

      {mode === 'game' && (
        <>
          <NumberField
            label="Condition"
            value={icon.condition}
            min={0}
            max={12}
            onChange={(condition) => patch({ condition })}
          />

          {/* Fiche rapide + attaque (CDC §4.3) */}
          {icon.kind === 'enemyHacker' ? (
            <>
              <NumberField
                label="Réserve d'attaque"
                value={icon.atkPool ?? 10}
                min={1}
                max={20}
                onChange={(atkPool) => patch({ atkPool })}
              />
              <NumberField
                label="Réserve de défense"
                value={icon.defPool ?? 8}
                min={1}
                max={20}
                onChange={(defPool) => patch({ defPool })}
              />
            </>
          ) : (
            <div className="mb-2 rounded border border-grid bg-panel-2 p-2 text-[10px] leading-4 text-ink-dim">
              <p>
                FW {ICE_STATS.firewall} · Log {ICE_STATS.logique} · attaque{' '}
                {ICE_STATS.attackPool}D{effect?.attackBonus ? `+${effect.attackBonus}` : ''} ·
                dégâts {ICE_STATS.baseDamage}+nets
              </p>
              {effect?.onHitText && <p className="text-neon-red">Impact : {effect.onHitText}</p>}
              {effect?.passiveText && <p>{effect.passiveText}</p>}
            </div>
          )}
          <button className="btn btn-red mb-1 w-full text-xs" onClick={() => void doAttack()}>
            ⚔ Attaquer le decker
          </button>
          {attackResult && (
            <p className="mb-2 text-[11px] text-neon-amber">{attackResult}</p>
          )}
        </>
      )}

      {mode === 'edit' && (
        <button
          className="btn btn-red w-full text-xs"
          onClick={() => {
            if (window.confirm(`Supprimer « ${icon.label} » ?`)) {
              void deleteIcon(code, iconId);
              onDeleted();
            }
          }}
        >
          Supprimer l'icône
        </button>
      )}
    </div>
  );
}
