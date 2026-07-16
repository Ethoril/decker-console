import { useMemo, useState } from 'react';
import NetworkMap, { type MapSelection } from '../components/map/NetworkMap';
import { ICE_LABELS, NODE_TYPE_LABELS } from '../components/map/shapes';
import { RollModal, type RollRequest } from '../components/decker/RollModal';
import { PresenceDot, SideColumn, useIsShort } from '../components/ui';
import { PERSONA } from '../data/persona';
import { MARK_RIGHTS } from '../data/security';
import {
  APPROACH_LABELS,
  MODE_LABELS,
  applyHack,
  applyIceAnalysis,
  applyScan,
  canMoveTo,
  controlDevice,
  knownLabel,
  moveDeckerTo,
  readPaydata,
  setConnectionMode,
  type HackApproach,
} from '../game/actions';
import { adjacentNodeIds } from '../game/graph';
import { infiltrationPool, perceptionPool } from '../game/pools';
import { deckerDefaults, useNetworkStore } from '../store/network';
import { useSessionStore } from '../store/session';
import type { ConnectionMode, Link, MatrixIcon, NetworkNode } from '../types';

export default function DeckerView() {
  const code = useSessionStore((s) => s.code)!;
  const leave = useSessionStore((s) => s.leave);
  const { meta, nodes, links, icons, decker, environment, log } = useNetworkStore();
  const short = useIsShort();

  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [roll, setRoll] = useState<RollRequest | null>(null);
  const [approachPick, setApproachPick] = useState(false);
  const [revealedInfo, setRevealedInfo] = useState<{ title: string; text: string } | null>(null);

  const mode = decker.mode ?? deckerDefaults.mode;
  const luck = decker.luck ?? deckerDefaults.luck;
  const stun = decker.stun ?? deckerDefaults.stun;
  const physical = decker.physical ?? deckerDefaults.physical;
  const deckerNodeId = decker.nodeId ?? null;

  // ------------------------------------------------------------ fog of war
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
  const selectedIconId = selection?.kind === 'icon' ? selection.id : null;
  const selectedIcon = selectedIconId ? visibleIcons[selectedIconId] : undefined;

  const move = selectedNodeId ? canMoveTo(selectedNodeId) : { ok: false, reason: null };

  // Cible de hack : nœud sélectionné, visible, adjacent OU nœud courant.
  const hackTargetId =
    selectedNodeId &&
    selectedNode &&
    (adjacent.has(selectedNodeId) || selectedNodeId === deckerNodeId)
      ? selectedNodeId
      : null;

  // ------------------------------------------------------------- actions
  const startScan = () => {
    setRoll({
      action: 'Perception matricielle — scan',
      lines: perceptionPool(mode),
      withComplication: false,
      apply: (successes) => applyScan(code, successes),
    });
  };

  const startIceAnalysis = () => {
    if (!selectedIconId) return;
    setRoll({
      action: 'Perception matricielle — analyse de GLACE',
      lines: perceptionPool(mode),
      withComplication: false,
      apply: (successes) => applyIceAnalysis(code, selectedIconId, successes),
    });
  };

  const startHack = (approach: HackApproach) => {
    setApproachPick(false);
    if (!hackTargetId) return;
    const target = nodes[hackTargetId];
    if (!target) return;
    setRoll({
      action: `Hack (${APPROACH_LABELS[approach]}) — ${knownLabel(hackTargetId)}`,
      lines: infiltrationPool(target, mode, environment),
      withComplication: true,
      apply: (successes) => applyHack(code, hackTargetId, approach, successes),
    });
  };

  const doMove = async () => {
    if (selectedNodeId && (await moveDeckerTo(code, selectedNodeId))) setSelection(null);
  };

  const doReadPaydata = async () => {
    if (!deckerNodeId) return;
    const text = await readPaydata(code, deckerNodeId);
    if (text) setRevealedInfo({ title: 'Paydata', text });
  };

  const doControlDevice = async () => {
    if (!deckerNodeId) return;
    const text = await controlDevice(code, deckerNodeId);
    if (text) setRevealedInfo({ title: 'Périphérique', text });
  };

  const changeMode = (m: ConnectionMode) => {
    if (m === mode) return;
    if (
      mode === 'AR' &&
      m !== 'AR' &&
      !window.confirm(
        `Connexion ${MODE_LABELS[m]} : trait Écorché → +${PERSONA.traits.ecorche} cases Étourdissant. Continuer ?`,
      )
    ) {
      return;
    }
    void setConnectionMode(code, m);
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
        {/* Colonne d'état */}
        <SideColumn side="left" title="État" short={short} width="w-52">
          <h3 className="panel-title">Persona</h3>
          <div className="mb-2 rounded border border-grid bg-panel-2 p-2 text-xs leading-5">
            <p className="text-neon-cyan">{PERSONA.name}</p>
            <p className="text-ink-dim">Deck : {PERSONA.deck.name}</p>
          </div>

          {/* Mode de connexion */}
          <div className="mb-2">
            <span className="mb-1 block text-[10px] tracking-wider text-ink-dim uppercase">
              Mode de connexion
            </span>
            <div className="grid grid-cols-3 gap-1">
              {(['AR', 'VR', 'HOTSIM'] as ConnectionMode[]).map((m) => (
                <button
                  key={m}
                  className={`btn px-1 py-1.5 text-[11px] ${mode === m ? 'btn-cyan active' : ''}`}
                  aria-pressed={mode === m}
                  onClick={() => changeMode(m)}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Jauges (moniteurs complets en Phase 3) */}
          <div className="mb-2 rounded border border-grid bg-panel-2 p-2 text-xs leading-5">
            <p>
              🍀 Chance : <span className="text-neon-green">{luck}</span>/{PERSONA.chance}
            </p>
            <p>
              Étourdissant : <span className={stun > 0 ? 'text-neon-amber' : ''}>{stun}</span>
            </p>
            <p>
              Physique : <span className={physical > 0 ? 'text-neon-red' : ''}>{physical}</span>
            </p>
            <p className="text-[10px] text-ink-dim">Moniteurs complets — Phase 3</p>
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
            onNodeTap={(id) => {
              setSelection({ kind: 'node', id });
              setApproachPick(false);
            }}
            onIconTap={(id) => {
              setSelection({ kind: 'icon', id });
              setApproachPick(false);
            }}
            onBackgroundTap={() => {
              setSelection(null);
              setApproachPick(false);
            }}
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
              <span className="text-neon-cyan">{knownLabel(deckerNodeId)}</span>
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <button
              className="btn btn-cyan text-xs"
              disabled={!deckerNodeId}
              onClick={startScan}
            >
              ◈ Scanner les environs
            </button>

            {/* Hacker : choix d'approche */}
            {!approachPick ? (
              <button
                className="btn btn-cyan text-xs"
                disabled={!hackTargetId}
                onClick={() => setApproachPick(true)}
              >
                ⚡ Hacker {hackTargetId ? `« ${knownLabel(hackTargetId)} »` : ''}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <button className="btn btn-red text-[11px]" onClick={() => startHack('bruteForce')}>
                  Force Brute
                </button>
                <button
                  className="btn btn-magenta text-[11px]"
                  onClick={() => startHack('corruption')}
                >
                  Corruption
                </button>
              </div>
            )}

            <button className="btn btn-cyan text-xs" disabled={!move.ok} onClick={() => void doMove()}>
              → Se déplacer ici
            </button>
            {move.reason && <p className="text-[10px] leading-4 text-neon-amber">{move.reason}</p>}

            {selectedIcon && !selectedIcon.revealed && (
              <button className="btn btn-cyan text-xs" onClick={startIceAnalysis}>
                ◇ Analyser la GLACE
              </button>
            )}

            <button
              className="btn text-xs"
              disabled={!currentNode || currentNode.marks < 2 || !currentNode.paydata}
              onClick={() => void doReadPaydata()}
            >
              ▤ Lire le paydata (≥ 2 Marks)
            </button>
            <button
              className="btn text-xs"
              disabled={!currentNode || currentNode.marks < 3 || !currentNode.deviceInfo}
              onClick={() => void doControlDevice()}
            >
              ⌘ Contrôler le périphérique (≥ 3 Marks)
            </button>
          </div>

          {/* Contenu révélé (paydata / périphérique) */}
          {revealedInfo && (
            <div className="mt-3 rounded border border-neon-green/40 bg-panel-2 p-2 text-xs leading-5">
              <div className="flex items-center justify-between">
                <h4 className="panel-title mb-1">{revealedInfo.title}</h4>
                <button className="btn px-1.5 py-0 text-[10px]" onClick={() => setRevealedInfo(null)}>
                  ✕
                </button>
              </div>
              <p className="text-neon-green">{revealedInfo.text}</p>
            </div>
          )}

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
                  {selectedNode.marks > 0 && (
                    <p className="text-[10px] text-ink-dim">
                      {MARK_RIGHTS[selectedNode.marks]}
                    </p>
                  )}
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
                  <p className="text-neon-red">GLACE — {ICE_LABELS[selectedIcon.iceType]}</p>
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

      {roll && <RollModal code={code} request={roll} onClose={() => setRoll(null)} />}
    </div>
  );
}
