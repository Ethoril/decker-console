import { useState } from 'react';
import { clearNetwork, exportNetwork, importNetwork } from '../../sync/write';
import type { NetworkExport } from '../../types';
import { NETWORK_TEMPLATES, type NetworkTemplate } from '../../data/networkTemplates';
import {
  GENERATOR_ITEMS,
  generateNetwork,
  type GeneratorCounts,
  type GeneratorDifficulty,
} from '../../game/networkGenerator';

/** Export / import JSON du réseau (nodes + links + icons + position decker). */
export function ExportImportModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [counts, setCounts] = useState<GeneratorCounts>({});
  const [difficulty, setDifficulty] = useState<GeneratorDifficulty>('standard');

  const selectedCount = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const changeCount = (id: string, delta: number) => {
    setCounts((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(9, (current[id] ?? 0) + delta)),
    }));
  };

  const doGenerate = async () => {
    if (selectedCount < 1) return;
    if (!window.confirm('Générer ce réseau ? Le réseau actuel sera intégralement remplacé.')) return;
    const generated = generateNetwork(counts, difficulty);
    await importNetwork(code, generated);
    setText(JSON.stringify(generated, null, 2));
    setMessage(`Réseau généré : ${selectedCount} élément(s), sans IA.`);
  };

  const doExport = () => {
    const json = JSON.stringify(exportNetwork(), null, 2);
    setText(json);
    setMessage('Réseau exporté dans la zone de texte.');
  };

  const doDownload = () => {
    const json = text || JSON.stringify(exportNetwork(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decker-network-${code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    setMessage(null);
    let data: NetworkExport;
    try {
      data = JSON.parse(text) as NetworkExport;
    } catch {
      setMessage('JSON invalide.');
      return;
    }
    if (typeof data !== 'object' || data === null || !('network' in data)) {
      setMessage('Format inattendu : clé « network » absente.');
      return;
    }
    if (!window.confirm('Remplacer intégralement le réseau actuel par cet import ?')) return;
    await importNetwork(code, data);
    setMessage('Réseau importé.');
  };

  const doClear = async () => {
    if (!window.confirm('Vider complètement le réseau (nœuds, liens, icônes) ?')) return;
    await clearNetwork(code);
    setMessage('Réseau vidé.');
  };

  const loadTemplate = async (template: NetworkTemplate) => {
    if (
      !window.confirm(
        `Charger « ${template.name} » ? Le réseau actuel sera intégralement remplacé.`,
      )
    ) {
      return;
    }
    await importNetwork(code, template.data);
    setMessage(`Réseau « ${template.name} » chargé.`);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-abyss/80" />
      <div
        className="relative z-10 flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-y-auto rounded border border-grid bg-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="panel-title mb-0">Export / Import du réseau</h2>
          <button className="btn px-2 py-0.5 text-xs" onClick={onClose}>
            ✕
          </button>
        </div>
        <div>
          <h3 className="panel-title">Bibliothèque de réseaux</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {NETWORK_TEMPLATES.map((template) => (
              <button
                key={template.id}
                className="btn h-auto min-h-24 text-left"
                onClick={() => void loadTemplate(template)}
              >
                <span className="block text-xs text-neon-cyan">{template.name}</span>
                <span
                  className={`my-1 block text-[9px] tracking-wider uppercase ${
                    template.difficulty === 'Hostile'
                      ? 'text-neon-red'
                      : template.difficulty === 'Standard'
                        ? 'text-neon-amber'
                        : 'text-neon-green'
                  }`}
                >
                  {template.difficulty}
                </span>
                <span className="block text-[10px] leading-4 text-ink-dim">
                  {template.description}
                </span>
              </button>
            ))}
          </div>
        </div>
        <details className="rounded border border-grid bg-panel-2 p-3" open>
          <summary className="cursor-pointer text-xs tracking-wider text-neon-magenta uppercase">
            Générateur automatique — sans IA
          </summary>
          <div className="mt-3 flex items-end gap-3">
            <label className="flex-1">
              <span className="mb-1 block text-[10px] tracking-wider text-ink-dim uppercase">Sécurité</span>
              <select
                className="field"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as GeneratorDifficulty)}
              >
                <option value="low">Faible</option>
                <option value="standard">Standard</option>
                <option value="high">Élevée</option>
              </select>
            </label>
            <button
              className="btn text-[10px]"
              disabled={selectedCount < 1}
              onClick={() => setCounts({})}
            >
              Remise à zéro
            </button>
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {GENERATOR_ITEMS.map((item) => {
              const count = counts[item.id] ?? 0;
              return (
                <div key={item.id} className="flex items-center gap-2 rounded border border-grid px-2 py-1.5">
                  <span className="min-w-0 flex-1 text-[11px]">{item.label}</span>
                  <button className="btn px-2 py-0.5" disabled={count < 1} onClick={() => changeCount(item.id, -1)}>−</button>
                  <span className="w-4 text-center text-xs text-neon-cyan">{count}</span>
                  <button className="btn px-2 py-0.5" disabled={count >= 9} onClick={() => changeCount(item.id, 1)}>+</button>
                </div>
              );
            })}
          </div>
          <button
            className="btn btn-magenta mt-3 w-full py-2 text-xs"
            disabled={selectedCount < 1}
            onClick={() => void doGenerate()}
          >
            Générer le réseau ({selectedCount} élément{selectedCount > 1 ? 's' : ''})
          </button>
          <p className="mt-2 text-[10px] text-ink-dim">
            Même sélection, même réseau : point d’accès, passerelle et trois branches calculées localement.
          </p>
        </details>
        <textarea
          className="field min-h-40 flex-1 resize-none text-xs"
          placeholder="Collez ici un JSON de réseau à importer, ou cliquez Exporter…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-cyan flex-1 text-xs" onClick={doExport}>
            Exporter
          </button>
          <button className="btn flex-1 text-xs" onClick={doDownload}>
            Télécharger .json
          </button>
          <button
            className="btn btn-magenta flex-1 text-xs"
            disabled={!text.trim()}
            onClick={() => void doImport()}
          >
            Importer
          </button>
          <button className="btn btn-red flex-1 text-xs" onClick={() => void doClear()}>
            Vider le réseau
          </button>
        </div>
        {message && <p className="text-xs text-neon-green">{message}</p>}
      </div>
    </div>
  );
}
