import { useState } from 'react';
import NetworkMap, { type MapSelection } from '../components/map/NetworkMap';
import { ExportImportModal } from '../components/gm/ExportImportModal';
import { GamePanel } from '../components/gm/GamePanel';
import { IconPanel } from '../components/gm/IconPanel';
import { NodePanel } from '../components/gm/NodePanel';
import { PresenceDot, SideColumn, useIsShort } from '../components/ui';
import { SoundToggle } from '../components/SoundToggle';
import { useNetworkStore } from '../store/network';
import { useSessionStore } from '../store/session';
import {
  createIcon,
  createLink,
  createNode,
  deleteLink,
  moveIcon,
  updateNode,
} from '../sync/write';
import type { IconKind } from '../types';

type Mode = 'edit' | 'game';
type Tool = 'select' | 'addNode' | 'link' | 'addIce' | 'addSpider' | 'addHacker';

const ICON_TOOLS: Partial<Record<Tool, IconKind>> = {
  addIce: 'ice',
  addSpider: 'spider',
  addHacker: 'enemyHacker',
};

export default function GmView() {
  const code = useSessionStore((s) => s.code)!;
  const leave = useSessionStore((s) => s.leave);
  const { meta, nodes, links, icons, decker } = useNetworkStore();
  const deckerNodeId = decker.nodeId ?? null;
  const short = useIsShort();

  const [mode, setMode] = useState<Mode>('edit');
  const [tool, setTool] = useState<Tool>('select');
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setTool('select');
    setPendingLink(null);
  };

  const onBackgroundTap = (x: number, y: number) => {
    if (mode === 'edit' && tool === 'addNode') {
      void createNode(code, {
        label: `Nœud ${Object.keys(nodes).length + 1}`,
        type: 'device',
        x,
        y,
        security: 3,
        state: 'hidden',
        marks: 0,
        paydata: null,
        deviceInfo: null,
      }).then((id) => setSelection({ kind: 'node', id }));
      setTool('select');
      return;
    }
    setSelection(null);
    setPendingLink(null);
  };

  const onNodeTap = (id: string) => {
    if (mode === 'edit' && tool === 'link') {
      if (!pendingLink) {
        setPendingLink(id);
      } else if (pendingLink !== id) {
        void createLink(code, pendingLink, id);
        setPendingLink(null);
      } else {
        setPendingLink(null);
      }
      return;
    }
    const iconKind = ICON_TOOLS[tool];
    if (mode === 'edit' && iconKind) {
      void createIcon(code, iconKind, id).then((iconId) =>
        setSelection({ kind: 'icon', id: iconId }),
      );
      setTool('select');
      return;
    }
    setSelection({ kind: 'node', id });
  };

  const onLinkTap = (id: string) => {
    if (mode === 'edit' && tool === 'link') void deleteLink(code, id);
  };

  const copyLink = (role: 'gm' | 'decker') => {
    const url = new URL(window.location.href);
    url.searchParams.set('session', code);
    url.searchParams.set('role', role);
    void navigator.clipboard.writeText(url.toString());
  };

  const toolButton = (t: Tool, text: string) => (
    <button
      className={`btn w-full text-left text-xs ${tool === t ? 'btn-cyan active' : ''}`}
      aria-pressed={tool === t}
      onClick={() => {
        setTool(t);
        setPendingLink(null);
      }}
    >
      {text}
    </button>
  );

  const selectedNode = selection?.kind === 'node' ? nodes[selection.id] : undefined;
  const selectedIcon = selection?.kind === 'icon' ? icons[selection.id] : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Barre de titre */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-grid bg-panel px-3">
        <span className="text-xs tracking-[0.2em] text-neon-magenta uppercase">MJ</span>
        <span className="glow-text text-sm tracking-[0.25em] text-neon-cyan">{code}</span>
        <PresenceDot connected={meta?.deckerConnected ?? false} label="Decker" />
        <div className="ml-auto flex items-center gap-1">
          <button
            className={`btn px-2 py-1 text-xs ${mode === 'edit' ? 'btn-cyan active' : ''}`}
            aria-pressed={mode === 'edit'}
            onClick={() => switchMode('edit')}
          >
            Édition
          </button>
          <button
            className={`btn px-2 py-1 text-xs ${mode === 'game' ? 'btn-magenta active' : ''}`}
            aria-pressed={mode === 'game'}
            onClick={() => switchMode('game')}
          >
            Jeu
          </button>
          <button className="btn ml-2 px-2 py-1 text-xs" onClick={leave}>
            Quitter
          </button>
          <SoundToggle />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Colonne outils */}
        <SideColumn side="left" title="Outils" short={short} width="w-44">
          {mode === 'edit' ? (
            <div className="flex flex-col gap-1.5">
              <h3 className="panel-title">Édition</h3>
              {toolButton('select', '↖ Sélection')}
              {toolButton('addNode', '+ Nœud')}
              {toolButton('link', '⇄ Lier / délier')}
              {toolButton('addIce', '◆ + GLACE')}
              {toolButton('addSpider', '✳ + Spider')}
              {toolButton('addHacker', '◎ + Hacker')}
              {tool === 'link' && (
                <p className="text-[10px] leading-4 text-ink-dim">
                  {pendingLink
                    ? 'Touchez le second nœud (ou le même pour annuler). Touchez un lien pour le supprimer.'
                    : 'Touchez le premier nœud, ou un lien existant pour le supprimer.'}
                </p>
              )}
              {tool === 'addNode' && (
                <p className="text-[10px] leading-4 text-ink-dim">
                  Touchez le fond de la carte pour poser le nœud.
                </p>
              )}
              {ICON_TOOLS[tool] && (
                <p className="text-[10px] leading-4 text-ink-dim">
                  Touchez un nœud pour y poser l'icône.
                </p>
              )}
              <hr className="my-1 border-grid" />
              <button className="btn w-full text-left text-xs" onClick={() => setExportOpen(true)}>
                ⇩⇧ Export / Import
              </button>
              <button className="btn w-full text-left text-xs" onClick={() => copyLink('decker')}>
                ⎘ Copier lien Decker
              </button>
            </div>
          ) : (
            <GamePanel code={code} />
          )}
        </SideColumn>

        {/* Carte */}
        <main className="min-w-0 flex-1">
          <NetworkMap
            nodes={nodes}
            links={links}
            icons={icons}
            deckerNodeId={deckerNodeId}
            selection={pendingLink ? { kind: 'node', id: pendingLink } : selection}
            nodesDraggable={mode === 'edit' && tool === 'select'}
            iconsDraggable={mode === 'game'}
            onNodeTap={onNodeTap}
            onIconTap={(id) => setSelection({ kind: 'icon', id })}
            onLinkTap={onLinkTap}
            onBackgroundTap={onBackgroundTap}
            onNodeMove={(id, x, y) => void updateNode(code, id, { x, y })}
            onIconDrop={(id, nodeId) => void moveIcon(code, id, nodeId)}
          />
        </main>

        {/* Panneau de propriétés */}
        <SideColumn side="right" title="Propriétés" short={short}>
          {selection?.kind === 'node' && selectedNode ? (
            <NodePanel
              key={selection.id}
              code={code}
              nodeId={selection.id}
              node={selectedNode}
              mode={mode}
              isDeckerHere={deckerNodeId === selection.id}
              onDeleted={() => setSelection(null)}
            />
          ) : selection?.kind === 'icon' && selectedIcon ? (
            <IconPanel
              key={selection.id}
              code={code}
              iconId={selection.id}
              icon={selectedIcon}
              mode={mode}
              onDeleted={() => setSelection(null)}
            />
          ) : (
            <p className="text-xs leading-5 text-ink-dim">
              Sélectionnez un nœud ou une icône sur la carte pour éditer ses
              propriétés.
            </p>
          )}
        </SideColumn>
      </div>

      {exportOpen && <ExportImportModal code={code} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
