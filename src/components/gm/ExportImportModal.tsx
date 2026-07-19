import { useState } from 'react';
import { clearNetwork, exportNetwork, importNetwork } from '../../sync/write';
import type { NetworkExport } from '../../types';
import { NETWORK_TEMPLATES, type NetworkTemplate } from '../../data/networkTemplates';

/** Export / import JSON du réseau (nodes + links + icons + position decker). */
export function ExportImportModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

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
        className="relative z-10 flex max-h-full w-full max-w-2xl flex-col gap-3 rounded border border-grid bg-panel p-4"
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
