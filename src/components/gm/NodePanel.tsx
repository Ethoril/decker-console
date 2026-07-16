import { NODE_TYPE_LABELS } from '../map/shapes';
import { deleteNode, setDeckerNode, updateNode } from '../../sync/write';
import type { NetworkNode, NodeState, NodeType } from '../../types';
import { CommitField, NumberField, SelectField } from './fields';

const STATE_LABELS: Array<[NodeState, string]> = [
  ['hidden', 'Caché'],
  ['spotted', 'Repéré'],
  ['infiltrated', 'Infiltré'],
  ['alerted', 'En alerte'],
];

export function NodePanel({
  code,
  nodeId,
  node,
  mode,
  isDeckerHere,
  onDeleted,
}: {
  code: string;
  nodeId: string;
  node: NetworkNode;
  mode: 'edit' | 'game';
  isDeckerHere: boolean;
  onDeleted: () => void;
}) {
  const patch = (partial: Partial<NetworkNode>) => void updateNode(code, nodeId, partial);

  return (
    <div>
      <h3 className="panel-title">Nœud</h3>

      {mode === 'edit' ? (
        <>
          <CommitField label="Label" value={node.label} onCommit={(v) => patch({ label: v })} />
          <SelectField
            label="Type"
            value={node.type}
            options={(Object.entries(NODE_TYPE_LABELS) as Array<[NodeType, string]>).map(
              ([v, t]) => [v, t],
            )}
            onChange={(type) => patch({ type })}
          />
          <NumberField
            label="Sécurité (1-10)"
            value={node.security}
            min={1}
            max={10}
            onChange={(security) => patch({ security })}
          />
        </>
      ) : (
        <p className="mb-2 text-xs text-ink-dim">
          {node.label} · {NODE_TYPE_LABELS[node.type]} · S{node.security}
        </p>
      )}

      {/* État + marks : accessibles dans les deux modes */}
      <div className="mb-2">
        <span className="mb-1 block text-[10px] tracking-wider text-ink-dim uppercase">
          État
        </span>
        <div className="grid grid-cols-2 gap-1">
          {STATE_LABELS.map(([state, text]) => (
            <button
              key={state}
              className={`btn px-1 py-1 text-[11px] ${node.state === state ? 'btn-cyan active' : ''}`}
              onClick={() => patch({ state })}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <NumberField
        label="Marks (0-4)"
        value={node.marks}
        min={0}
        max={4}
        onChange={(marks) => patch({ marks })}
      />

      {mode === 'edit' && (
        <>
          <CommitField
            label="Paydata (visible MJ)"
            value={node.paydata ?? ''}
            textarea
            placeholder="Butin extractible…"
            onCommit={(v) => patch({ paydata: v || null })}
          />
          <CommitField
            label="Périphérique contrôlé"
            value={node.deviceInfo ?? ''}
            textarea
            placeholder="Caméras, maglock…"
            onCommit={(v) => patch({ deviceInfo: v || null })}
          />
        </>
      )}

      <button
        className="btn btn-cyan mb-2 w-full text-xs"
        disabled={isDeckerHere}
        onClick={() => void setDeckerNode(code, nodeId)}
      >
        {isDeckerHere ? 'Le decker est ici' : 'Placer le decker ici'}
      </button>

      {mode === 'edit' && (
        <button
          className="btn btn-red w-full text-xs"
          onClick={() => {
            if (window.confirm(`Supprimer le nœud « ${node.label} » (et ses liens/icônes) ?`)) {
              void deleteNode(code, nodeId);
              onDeleted();
            }
          }}
        >
          Supprimer le nœud
        </button>
      )}
    </div>
  );
}
