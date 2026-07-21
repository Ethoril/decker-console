import { useState } from 'react';
import { useNetworkStore } from '../../store/network';
import {
  saveNetworkToLibrary,
  loadNetworkPreset,
  deleteNetworkFromLibrary,
  renameNetworkInLibrary,
  seedDefaultLibrary,
} from '../../sync/write';
import type { NetworkPreset } from '../../types';

/** Construit les données de la carte à partir de l'état courant du store. */
function currentNetworkData(): Omit<NetworkPreset, 'id' | 'name' | 'createdAt'> {
  const { nodes, links, icons, decker } = useNetworkStore.getState();
  const entry = Object.entries(nodes).find(([, n]) => n.type === 'entry')?.[0];
  return {
    network: {
      nodes: Object.keys(nodes).length ? nodes : null,
      links: Object.keys(links).length ? links : null,
    },
    icons: Object.keys(icons).length ? icons : null,
    deckerNodeId: decker.nodeId ?? entry ?? null,
  };
}

const countNodes = (p: NetworkPreset) => (p.network?.nodes ? Object.keys(p.network.nodes).length : 0);
const countIce = (p: NetworkPreset) =>
  p.icons ? Object.values(p.icons).filter((i) => i.kind === 'ice').length : 0;

/** Gestion de la bibliothèque persistante de cartes (côté MJ). */
export function LibraryModal({ code, onClose }: { code: string; onClose: () => void }) {
  const library = useNetworkStore((s) => s.library);
  const nodeCount = useNetworkStore((s) => Object.keys(s.nodes).length);
  const presets = Object.values(library).sort((a, b) => b.createdAt - a.createdAt);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const doSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || nodeCount === 0) return;
    await saveNetworkToLibrary(code, null, trimmed, currentNetworkData());
    setName('');
    setMessage(`Carte « ${trimmed} » sauvegardée.`);
  };

  const doBroadcast = async (p: NetworkPreset) => {
    if (!window.confirm(`Diffuser « ${p.name} » au joueur ? Le réseau actuel sera remplacé (les jauges du Decker sont conservées).`)) return;
    await loadNetworkPreset(code, p);
    setMessage(`« ${p.name} » diffusé au joueur.`);
  };

  const doOverwrite = async (p: NetworkPreset) => {
    if (nodeCount === 0) return;
    if (!window.confirm(`Écraser « ${p.name} » avec la carte actuellement à l'écran ?`)) return;
    await saveNetworkToLibrary(code, p.id, p.name, currentNetworkData());
    setMessage(`« ${p.name} » mis à jour.`);
  };

  const doRename = async (p: NetworkPreset) => {
    const next = window.prompt('Nouveau nom :', p.name);
    if (!next || !next.trim()) return;
    await renameNetworkInLibrary(code, p.id, next.trim());
  };

  const doDelete = async (p: NetworkPreset) => {
    if (!window.confirm(`Supprimer « ${p.name} » de la bibliothèque ?`)) return;
    await deleteNetworkFromLibrary(code, p.id);
  };

  const doSeed = async () => {
    await seedDefaultLibrary(code);
    setMessage('Modèles par défaut ajoutés à la bibliothèque.');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-abyss/80" />
      <div
        className="relative z-10 flex max-h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded border border-grid bg-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="panel-title mb-0 font-bold uppercase tracking-wider text-neon-cyan">Mes cartes</h2>
          <button className="btn px-2 py-0.5 text-xs" onClick={onClose}>✕</button>
        </div>

        {/* Sauvegarde de la carte courante */}
        <div className="flex gap-2">
          <input
            className="field flex-1 text-xs"
            placeholder="Nom de la carte actuelle…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn btn-cyan text-xs"
            disabled={!name.trim() || nodeCount === 0}
            onClick={() => void doSave()}
          >
            💾 Sauvegarder
          </button>
        </div>
        {nodeCount === 0 && (
          <p className="text-[10px] text-ink-dim">Ajoutez au moins un nœud à la carte pour pouvoir la sauvegarder.</p>
        )}

        {/* Liste des cartes */}
        {presets.length === 0 ? (
          <div className="rounded border border-grid bg-panel-2 p-4 text-center">
            <p className="text-xs text-ink-dim">Aucune carte sauvegardée.</p>
            <button className="btn btn-magenta mt-3 text-xs" onClick={() => void doSeed()}>
              Générer les modèles par défaut
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {presets.map((p) => (
              <li key={p.id} className="rounded border border-grid bg-panel-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-neon-cyan">{p.name}</span>
                  <span className="text-[10px] text-ink-dim">
                    {countNodes(p)} nœud(s) · {countIce(p)} GLACE(s)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button className="btn btn-cyan flex-1 text-[11px] font-bold" onClick={() => void doBroadcast(p)}>
                    📡 Diffuser au joueur
                  </button>
                  <button className="btn text-[11px]" disabled={nodeCount === 0} onClick={() => void doOverwrite(p)}>Écraser</button>
                  <button className="btn text-[11px]" onClick={() => void doRename(p)}>Renommer</button>
                  <button className="btn btn-red text-[11px]" onClick={() => void doDelete(p)}>Supprimer</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {message && <p className="text-xs text-neon-green">{message}</p>}
      </div>
    </div>
  );
}
