import { useMemo, useState } from 'react';
import NetworkMap, { type MapSelection } from '../components/map/NetworkMap';
import { ICE_LABELS, NODE_TYPE_LABELS } from '../components/map/shapes';
import { PresenceDot, SideColumn, useIsShort } from '../components/ui';
import { moveDeckerTo, performScan } from '../game/actions';
import { adjacentNodeIds } from '../game/graph';
import { useNetworkStore } from '../store/network';
import { useSessionStore } from '../store/session';
import type { Link, MatrixIcon, NetworkNode } from '../types';

export default function DeckerView() {
  const code = useSessionStore((s) => s.code)!;
  const leave = useSessionStore((s) => s.leave);
  const { meta, nodes, links, icons, deckerNodeId, log } = useNetworkStore();
  const short = useIsShort();

  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // ------------------------------------------------------------ fog of war
  // Calculé côté client à partir des mêmes données que le MJ (cf. brief §1.4).
  const { visibleNodes, visibleLinks, visibleIcons } = useMemo(() => {
    const visibleNodes: Record<string, NetworkNode> = {};
    for (const [id, node] of Object.entries(nodes)) {
      if (node.state !== 'hidden') visibleNodes[id] = node;
    }
    const visibleLinks: Record<string, Link> = {};
    for (const [id, link] of Object.entries(links)) {
      if (visibleNodes[link.from] && visibleNodes[link.to]) visibleLinks[id] = link;
    }
    const visibleIcons: Record<string, MatrixIcon> = {};
    for (const [id, icon] of Object.entries(icons)) {
      if (icon.visibleToPlayer && visibleNodes[icon.nodeId]) visibleIcons[id] = icon;
    }
    return { visibleNodes, visibleLinks, visibleIcons };
  }, [nodes, links, icons]);

  const currentNode = deckerNodeId ? nodes[deckerNodeId] : undefined;
  const adjacent = useMemo(
    () => (deckerNodeId ? adjacentNodeIds(deckerNodeId, links) : new Set<string>()),
    [deckerNodeId, links],
  );

  const selectedNodeId = selection?.kind === 'node' ? selection.id : null;
  const selectedNode = selectedNodeId ? visibleNodes[selectedNodeId] : undefined;
  const selectedIcon = selection?.kind === 'icon' ? visibleIcons[selection.id] : undefined;
  const canMoveToSelection =
    !!selectedNodeId &&
    !!selectedNode &&
    selectedNodeId !== deckerNodeId &&
    adjacent.has(selectedNodeId);
  // TODO Phase 2 : exiger ≥ 1 Mark sur le nœud de destination (cf. CDC §3.4).

  const doScan = async () => {
    setBusy(true);
    try {
      await performScan(code);
    } finally {
      setBusy(false);
    }
  };

  const doMove = async () => {
    if (!selectedNodeId) return;
    setBusy(true);
    try {
      if (await moveDeckerTo(code, selectedNodeId)) setSelection(null);
    } finally {
      setBusy(false);
    }
  };

  const logEntries = useMemo(
    () =>
      Object.values(log)
        .filter((e) => e.visibility === 'all')
        .sort((a, b) => a.ts - b.ts)
        .slice(-80),
    [log],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Barre de titre */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-grid bg-panel px-3">
        <span className="text-xs tracking-[0.2em] text-neon-cyan uppercase">Decker</span>
        <span className="glow-text text-sm tracking-[0.25em] text-neon-cyan">{code}</span>
        <PresenceDot connected={meta?.gmConnected ?? false} label="MJ" />
        <button className="btn ml-auto px-2 py-1 text-xs" onClick={leave}>
          Se déconnecter
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Colonne d'état (placeholder Phase 2) */}
        <SideColumn side="left" title="État" short={short} width="w-52">
          <h3 className="panel-title">Persona</h3>
          <div className="mb-3 rounded border border-grid bg-panel-2 p-2 text-xs leading-5">
            <p className="text-neon-cyan">— decker —</p>
            <p className="text-ink-dim">Deck : Shiawase Cyber-5</p>
            <p className="text-ink-dim">Mode : RA</p>
          </div>
          {/* Emplacements Phase 2 : moniteurs, programmes, Chance */}
          <div className="mb-3 rounded border border-grid bg-panel-2 p-2 text-[10px] leading-5 text-ink-dim">
            <p>Moniteurs — Phase 2</p>
            <p>Programmes — Phase 2</p>
            <p>Chance — Phase 2</p>
          </div>
          <div className="rounded border border-grid bg-panel-2 p-2 text-center">
            <p className="text-[10px] tracking-widest text-ink-dim uppercase">Signal DIEU</p>
            <p className="mt-1 text-lg tracking-[0.3em] text-neon-red opacity-60">▓▓▓</p>
          </div>
        </SideColumn>

        {/* Carte avec fog of war */}
        <main className="min-w-0 flex-1">
          <NetworkMap
            nodes={visibleNodes}
            links={visibleLinks}
            icons={visibleIcons}
            deckerNodeId={deckerNodeId}
            fog
            selection={selection}
            onNodeTap={(id) => setSelection({ kind: 'node', id })}
            onIconTap={(id) => setSelection({ kind: 'icon', id })}
            onBackgroundTap={() => setSelection(null)}
          />
        </main>

        {/* Colonne d'actions */}
        <SideColumn side="right" title="Actions" short={short}>
          <h3 className="panel-title">Actions</h3>
          {!deckerNodeId ? (
            <p className="mb-2 text-xs leading-5 text-ink-dim">
              En attente : le MJ n'a pas encore placé votre persona sur le réseau.
            </p>
          ) : (
            <p className="mb-2 text-xs text-ink-dim">
              Position :{' '}
              <span className="text-neon-cyan">{currentNode?.label ?? '???'}</span>
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <button
              className="btn btn-cyan text-xs"
              disabled={busy || !deckerNodeId}
              onClick={() => void doScan()}
            >
              ◈ Scanner
            </button>
            <button
              className="btn btn-cyan text-xs"
              disabled={busy || !canMoveToSelection}
              onClick={() => void doMove()}
            >
              → Se déplacer ici
            </button>
            {selectedNodeId && !canMoveToSelection && selectedNodeId !== deckerNodeId && (
              <p className="text-[10px] leading-4 text-ink-dim">
                Déplacement possible uniquement vers un nœud adjacent.
              </p>
            )}
          </div>

          {/* Info du nœud sélectionné, filtrée selon son état */}
          {selectedNode && (
            <div className="mt-3 rounded border border-grid bg-panel-2 p-2 text-xs leading-5">
              <h4 className="panel-title">Nœud</h4>
              {selectedNode.state === 'spotted' ? (
                <>
                  <p className="text-ink">??? (non infiltré)</p>
                  <p className="text-ink-dim">Type : {NODE_TYPE_LABELS[selectedNode.type]}</p>
                </>
              ) : (
                <>
                  <p className="text-neon-cyan">{selectedNode.label}</p>
                  <p className="text-ink-dim">Type : {NODE_TYPE_LABELS[selectedNode.type]}</p>
                  <p className="text-ink-dim">Sécurité : {selectedNode.security}</p>
                  <p className="text-ink-dim">Marks : {selectedNode.marks}/4</p>
                  {selectedNode.state === 'alerted' && (
                    <p className="text-neon-red">⚠ EN ALERTE</p>
                  )}
                </>
              )}
            </div>
          )}
          {selectedIcon && (
            <div className="mt-3 rounded border border-grid bg-panel-2 p-2 text-xs leading-5">
              <h4 className="panel-title">Icône</h4>
              {selectedIcon.kind === 'ice' ? (
                selectedIcon.revealed && selectedIcon.iceType ? (
                  <p className="text-neon-red">
                    GLACE — {ICE_LABELS[selectedIcon.iceType]}
                  </p>
                ) : (
                  <p className="text-neon-red">GLACE non identifiée</p>
                )
              ) : selectedIcon.kind === 'spider' ? (
                <p className="text-neon-amber">Spider</p>
              ) : (
                <p className="text-neon-magenta">Hacker ennemi</p>
              )}
            </div>
          )}
        </SideColumn>
      </div>

      {/* Tiroir de log (bottom sheet, style terminal) */}
      <div className="shrink-0 border-t border-grid bg-panel">
        <button
          className="flex h-7 w-full items-center gap-2 px-3 text-[10px] tracking-[0.2em] text-ink-dim uppercase"
          onClick={() => setLogOpen((o) => !o)}
        >
          <span className="text-neon-green">▮</span> Log {logOpen ? '▼' : '▲'}
        </button>
        {logOpen && (
          <div className="h-32 overflow-y-auto px-3 pb-2 text-[11px] leading-5">
            {logEntries.length === 0 ? (
              <p className="text-ink-dim">— aucun événement —</p>
            ) : (
              logEntries.map((e, i) => (
                <p key={i} className="text-neon-green/80">
                  <span className="text-ink-dim">
                    {new Date(e.ts).toLocaleTimeString('fr-FR')}{' '}
                  </span>
                  {e.text}
                </p>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
