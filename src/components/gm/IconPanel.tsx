import { ICE_LABELS } from '../map/shapes';
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

  return (
    <div>
      <h3 className="panel-title">{KIND_LABELS[icon.kind]}</h3>

      {mode === 'edit' && (
        <>
          <CommitField label="Label" value={icon.label} onCommit={(v) => patch({ label: v })} />
          {icon.kind === 'ice' && (
            <SelectField
              label="Type de GLACE"
              value={icon.iceType ?? ''}
              options={[
                ['', '— non défini —'],
                ...(Object.entries(ICE_LABELS) as Array<[IceType, string]>),
              ]}
              onChange={(v) => patch({ iceType: (v || null) as IceType | null })}
            />
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
      <ToggleField
        label="Type identifié (revealed)"
        value={icon.revealed}
        onChange={(revealed) => patch({ revealed })}
      />

      {mode === 'game' && (
        <NumberField
          label="Condition"
          value={icon.condition}
          min={0}
          max={12}
          onChange={(condition) => patch({ condition })}
        />
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
