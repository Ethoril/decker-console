import { useEffect, useMemo, useState } from 'react';
import NetworkMap, { type MapSelection } from '../components/map/NetworkMap';
import { ICE_LABELS, NODE_TYPE_LABELS } from '../components/map/shapes';
import { DieuDial, MonitorBoxes } from '../components/decker/Monitors';
import { RollModal, type RollRequest } from '../components/decker/RollModal';
import { PresenceDot, SideColumn, useIsShort } from '../components/ui';
import { SoundToggle } from '../components/SoundToggle';
import { PERSONA } from '../data/persona';
import { MARK_RIGHTS } from '../data/security';
import {
  APPROACH_LABELS,
  applyHack,
  applyIceAnalysis,
  applyScan,
  canMoveTo,
  controlDevice,
  knownLabel,
  moveDeckerTo,
  readPaydata,
  type HackApproach,
} from '../game/actions';
import {
  MONITORS,
  applyDeckerAttack,
  applyEscape,
  applyRepair,
  checkSurveillance,
  reboot,
} from '../game/threat';
import { adjacentNodeIds } from '../game/graph';
import { applyTraceJamming } from '../game/minigames';
import {
  cybercombatPool,
  escapePool,
  infiltrationPool,
  perceptionPool,
  repairPool,
} from '../game/pools';
import { deckerDefaults, useNetworkStore } from '../store/network';
import { useSessionStore } from '../store/session';
import type { Link, MatrixIcon, NetworkNode } from '../types';

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
  const [dismissedTrapped, setDismissedTrapped] = useState(false);

  const luck = decker.luck ?? deckerDefaults.luck;
  const stun = decker.stun ?? deckerDefaults.stun;
  const physical = decker.physical ?? deckerDefaults.physical;
  const deckCondition = decker.deckCondition ?? deckerDefaults.deckCondition;
  const firewallPenalty = decker.firewallPenalty ?? deckerDefaults.firewallPenalty;
  const trapped = decker.trapped ?? false;
  const rebootCountdown = decker.rebootCountdown ?? 0;
  const convergence = decker.convergence ?? false;
  const debuffs = decker.debuffs ?? {};
  const programs = decker.programs ?? {};
  const deckerNodeId = decker.nodeId ?? null;

  // Réinitialise le dismiss de l'alerte Pot de colle quand le joueur n'est plus piégé
  useEffect(() => {
    if (!trapped) {
      setDismissedTrapped(false);
    }
  }, [trapped]);

  const deckDown = deckCondition >= MONITORS.deck;
  const rebooting = rebootCountdown > 0;
  const actionsLocked = rebooting || deckDown;
  const successPenalty = debuffs.bloqueuse ? 1 : 0;

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

  const hackTargetId =
    selectedNodeId &&
    selectedNode &&
    (adjacent.has(selectedNodeId) || selectedNodeId === deckerNodeId)
      ? selectedNodeId
      : null;

  // Cible de cybercombat : icône visible sur le nœud courant ou adjacent.
  const attackTargetId =
    selectedIconId &&
    selectedIcon &&
    (selectedIcon.nodeId === deckerNodeId || adjacent.has(selectedIcon.nodeId))
      ? selectedIconId
      : null;

  // ------------------------------------------------------------- actions
  const startScan = () =>
    setRoll({
      action: 'Perception matricielle — scan',
      lines: perceptionPool(),
      withComplication: false,
      apply: (s) => applyScan(code, s),
    });

  const startIceAnalysis = () => {
    if (!selectedIconId) return;
    setRoll({
      action: 'Perception matricielle — analyse de GLACE',
      lines: perceptionPool(),
      withComplication: false,
      apply: (s) => applyIceAnalysis(code, selectedIconId, s),
    });
  };

  const startHack = (approach: HackApproach) => {
    setApproachPick(false);
    if (!hackTargetId) return;
    const target = nodes[hackTargetId];
    if (!target) return;
    setRoll({
      action: `Hack (${APPROACH_LABELS[approach]}) — ${knownLabel(hackTargetId)}`,
      lines: infiltrationPool(target, environment),
      withComplication: true,
      successPenalty,
      apply: (s) => applyHack(code, hackTargetId, approach, s),
      miniGame: {
        kind: approach === 'corruption' ? 'injection' : 'overload',
        context: { type: 'hack', nodeId: hackTargetId, approach },
      },
      hackTargetId,
      hackMarksBefore: target.marks,
    });
  };

  const startAttack = () => {
    if (!attackTargetId) return;
    const icon = icons[attackTargetId];
    setRoll({
      action: `Cybercombat — ${icon?.label ?? 'cible'}`,
      lines: cybercombatPool(),
      withComplication: true,
      successPenalty,
      apply: (s) => applyDeckerAttack(code, attackTargetId, s),
    });
  };

  const startEscape = () =>
    setRoll({
      action: 'Fuite — Pot de colle',
      lines: escapePool(),
      withComplication: true,
      successPenalty,
      apply: (s) => applyEscape(code, s),
      miniGame: { kind: 'extraction', context: { type: 'escape' } },
    });

  const startPaydataDecrypt = () => {
    if (!deckerNodeId || !currentNode) return;
    setRoll({
      action: `Décryptage paydata — ${knownLabel(deckerNodeId)}`,
      lines: infiltrationPool(currentNode, environment),
      withComplication: true,
      successPenalty,
      apply: async (successes) => {
        if (successes < 1) return 'échec — chiffrement intact';
        const text = await readPaydata(code, deckerNodeId);
        if (!text) return 'aucune paydata exploitable';
        setRevealedInfo({ title: 'Paydata', text });
        return 'paydata déchiffrée';
      },
      miniGame: {
        kind: 'decryption',
        context: { type: 'paydata', nodeId: deckerNodeId },
      },
    });
  };

  const startJamming = () =>
    setRoll({
      action: 'Brouillage anti-pistage',
      lines: escapePool(),
      withComplication: true,
      successPenalty,
      apply: (s) => applyTraceJamming(code, s),
      miniGame: { kind: 'jamming', context: { type: 'trace' } },
    });

  const startRepair = () =>
    setRoll({
      action: 'Réparation du deck',
      lines: repairPool(),
      withComplication: false,
      apply: (s) => applyRepair(code, s),
    });

  const doMove = async () => {
    if (selectedNodeId && (await moveDeckerTo(code, selectedNodeId))) setSelection(null);
  };

  const handleRollClose = () => {
    const targetNodeId = roll?.hackTargetId;
    const marksBefore = roll?.hackMarksBefore ?? 0;
    setRoll(null);
    if (!targetNodeId) return;
    // La résolution du jet (chemin direct ou mini-jeu) a déjà été awaitée : la
    // latency-compensation Firebase a rafraîchi le store, on lit donc directement.
    const node = useNetworkStore.getState().nodes[targetNodeId];
    // On ne propose le déplacement que si CE hack a réellement gagné un Mark
    // (évite un « Hack réussi » trompeur sur un re-hack raté ou une annulation).
    if (node && node.marks > marksBefore && canMoveTo(targetNodeId).ok) {
      const confirmMove = window.confirm(
        `Hack réussi ! Voulez-vous vous déplacer sur « ${knownLabel(targetNodeId)} » ?`,
      );
      if (confirmMove) void moveDeckerTo(code, targetNodeId);
    }
  };

  const doControlDevice = async () => {
    if (!deckerNodeId) return;
    const text = await controlDevice(code, deckerNodeId);
    if (text) setRevealedInfo({ title: 'Périphérique', text });
  };

  const doReboot = () => {
    if (trapped) return;
    if (window.confirm('Rebooter le deck ? Surveillance purgée, console inactive 3 tours.')) {
      void reboot(code);
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
        {trapped && (
          <span className="pulse-alert text-xs text-neon-red">⛓ PIÉGÉ</span>
        )}
        <button
          className="btn ml-auto px-2 py-1 text-xs"
          disabled={trapped}
          title={trapped ? 'Pot de colle : déconnexion impossible' : undefined}
          onClick={leave}
        >
          Se déconnecter
        </button>
        <SoundToggle />
      </header>

      {/* Bandeau deck détruit */}
      {deckDown && (
        <div className="pulse-alert flex shrink-0 items-center justify-center gap-3 border-b border-neon-red bg-neon-red/15 px-3 py-1 text-xs text-neon-red">
          DECK HS — 1 Karma pour réparation immédiate
          <button className="btn btn-red px-2 py-0.5 text-[11px]" onClick={startRepair}>
            🔧 Réparer (Électronique + Logique)
          </button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {/* Colonne d'état */}
        <SideColumn side="left" title="État" short={short} width="w-56">
          <h3 className="panel-title">Persona</h3>
          <div className="mb-2 rounded border border-grid bg-panel-2 p-2 text-xs leading-5">
            <p className="text-neon-cyan">{PERSONA.name}</p>
            <p className="text-ink-dim">
              {PERSONA.deck.name}
              {firewallPenalty > 0 && (
                <span className="text-neon-red"> · FW −{firewallPenalty}</span>
              )}
            </p>
          </div>

          {/* Moniteurs */}
          <div className="mb-2 rounded border border-grid bg-panel-2 p-2">
            <MonitorBoxes label={`Deck (${PERSONA.deck.name.split(' ').pop()})`} filled={deckCondition} total={MONITORS.deck} color="bg-neon-cyan" />
            <MonitorBoxes label="Étourdissant" filled={stun} total={MONITORS.stun} color="bg-neon-amber" />
            <MonitorBoxes label="Physique" filled={physical} total={MONITORS.physical} color="bg-neon-red" />
            {deckCondition > 0 && !deckDown && (
              <button className="btn mt-1 w-full px-1 py-0.5 text-[10px]" onClick={startRepair}>
                🔧 Réparer le deck
              </button>
            )}
          </div>

          {/* Programmes & debuffs */}
          <div className="mb-2 rounded border border-grid bg-panel-2 p-2 text-[11px] leading-5">
            {PERSONA.programs.map((p) => {
              const crashed = programs[p.id as 'marteau' | 'discretion'] === 'crashed';
              return (
                <p key={p.id} className={crashed ? 'text-neon-red line-through' : ''}>
                  ▸ {p.id === 'marteau' ? 'Marteau' : 'Discrétion'}{' '}
                  <span className="text-ink-dim">({p.effect})</span>
                  {crashed && ' — PLANTÉ'}
                </p>
              );
            })}
            {Object.keys(debuffs).filter((k) => debuffs[k]).length > 0 && (
              <p className="text-neon-red">
                Debuffs : {Object.keys(debuffs).filter((k) => debuffs[k]).join(', ')}
              </p>
            )}
            <p>
              🍀 Chance : <span className="text-neon-green">{luck}</span>/{PERSONA.chance}
            </p>
            {(decker.traceDelay ?? 0) > 0 && (
              <p className="text-neon-magenta">◌ Trace brouillée : {decker.traceDelay} tour(s)</p>
            )}
          </div>

          <DieuDial
            surveillance={decker.surveillance ?? 0}
            revealed={decker.surveillanceRevealed ?? false}
          />
        </SideColumn>

        {/* Carte avec fog of war */}
        <main className="relative min-w-0 flex-1">
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
          {/* Console inactive pendant le reboot */}
          {rebooting && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-abyss/85">
              <p className="pulse-slow glow-text text-2xl tracking-[0.3em] text-neon-amber">
                REBOOT
              </p>
              <p className="text-sm text-ink-dim">
                Deck inactif — {rebootCountdown} tour{rebootCountdown > 1 ? 's' : ''} restant
                {rebootCountdown > 1 ? 's' : ''}
              </p>
            </div>
          )}
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
              disabled={actionsLocked || !deckerNodeId}
              onClick={startScan}
            >
              ◈ Scanner les environs
            </button>

            {!approachPick ? (
              <button
                className="btn btn-cyan text-xs"
                disabled={actionsLocked || !hackTargetId}
                onClick={() => setApproachPick(true)}
              >
                ⚡ Hacker {hackTargetId ? `« ${knownLabel(hackTargetId)} »` : ''}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <button className="btn btn-red h-auto py-2 text-[11px]" onClick={() => startHack('bruteForce')}>
                  <span className="block">Force Brute</span>
                  <span className="mt-1 block text-[9px] leading-3 opacity-70">Rapide · échec = dégâts</span>
                </button>
                <button
                  className="btn btn-magenta h-auto py-2 text-[11px]"
                  onClick={() => startHack('corruption')}
                >
                  <span className="block">Corruption</span>
                  <span className="mt-1 block text-[9px] leading-3 opacity-70">Discrète · échec = alerte</span>
                </button>
              </div>
            )}

            <button
              className="btn btn-red text-xs"
              disabled={actionsLocked || !attackTargetId}
              onClick={startAttack}
            >
              ⚔ Attaquer {attackTargetId ? `« ${icons[attackTargetId]?.label} »` : ''}
            </button>

            <button className="btn btn-cyan text-xs" disabled={actionsLocked || !move.ok} onClick={() => void doMove()}>
              → Se déplacer ici
            </button>
            {move.reason && <p className="text-[10px] leading-4 text-neon-amber">{move.reason}</p>}

            {selectedIcon && !selectedIcon.revealed && (
              <button className="btn btn-cyan text-xs" disabled={actionsLocked} onClick={startIceAnalysis}>
                ◇ Analyser la GLACE
              </button>
            )}
            {selectedIcon?.kind === 'ice' &&
              selectedIcon.revealed &&
              selectedIcon.iceType === 'traceuse' && (
                <button className="btn btn-magenta text-xs" disabled={actionsLocked} onClick={startJamming}>
                  ◌ Brouiller la Traceuse
                </button>
              )}

            <button
              className="btn text-xs"
              disabled={actionsLocked || !currentNode || currentNode.marks < 2 || !currentNode.paydata}
              onClick={startPaydataDecrypt}
            >
              ▤ Décrypter le paydata (≥ 2 Marks)
            </button>
            <button
              className="btn text-xs"
              disabled={actionsLocked || !currentNode || currentNode.marks < 3 || !currentNode.deviceInfo}
              onClick={() => void doControlDevice()}
            >
              ⌘ Contrôler le périphérique (≥ 3 Marks)
            </button>

            <hr className="my-1 border-grid" />

            <button
              className="btn text-xs"
              disabled={actionsLocked || !deckerNodeId}
              onClick={() => void checkSurveillance(code)}
            >
              👁 Vérifier la Surveillance (1 tour)
            </button>
            {trapped && (
              <button className="btn btn-red text-xs" disabled={actionsLocked} onClick={startEscape}>
                ⛓ S'arracher au Pot de colle
              </button>
            )}
            <button
              className="btn text-xs"
              disabled={rebooting || trapped}
              title={trapped ? 'Pot de colle : reboot impossible' : undefined}
              onClick={doReboot}
            >
              ⟳ Rebooter (Surveillance → 0, 3 tours)
            </button>
          </div>

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
                    <p className="text-[10px] text-ink-dim">{MARK_RIGHTS[selectedNode.marks]}</p>
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

      {/* Tiroir de log */}
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
                <p
                  key={i}
                  className={e.kind === 'alert' ? 'text-neon-red' : 'text-neon-green/80'}
                >
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

      {roll && <RollModal code={code} request={roll} onClose={handleRollClose} />}

      {/* Convergence du DIEU : plein écran rouge */}
      {convergence && (
        <div className="convergence-screen fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-5">
          <div className="convergence-frame relative w-full max-w-2xl border border-neon-red/70 bg-abyss/70 p-6 text-center">
            <div className="mb-5 flex items-center justify-between text-[10px] tracking-[0.25em] text-neon-red/70">
              <span>GRID OVERWATCH DIVISION</span>
              <span>TRACE // 100%</span>
            </div>
            <p className="glitch-text text-4xl font-bold tracking-[0.18em] text-neon-red sm:text-6xl">
              LE DIEU CONVERGE
            </p>
            <div className="mx-auto my-5 h-px max-w-md bg-neon-red shadow-[0_0_16px_var(--color-neon-red)]" />
            <p className="text-sm tracking-wider text-neon-red/90">
              POSITION PHYSIQUE COMPROMISE
            </p>
            <p className="mt-2 text-xs leading-6 text-ink-dim">
              Éjection forcée de la Matrice · Liaison persona interrompue
              <br />
              Le MJ reprend la main.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-[10px] text-neon-red/60">
              <span className="border border-neon-red/20 p-2">DECK // LOCK</span>
              <span className="border border-neon-red/20 p-2">SIGNAL // LOST</span>
              <span className="border border-neon-red/20 p-2">GOD // ONLINE</span>
            </div>
          </div>
        </div>
      )}

      {/* Alerte Pot de colle : plein écran rouge dismissible (la convergence prime) */}
      {trapped && !dismissedTrapped && !convergence && (
        <div className="convergence-screen fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-5">
          <div className="convergence-frame relative w-full max-w-md border border-neon-red/70 bg-abyss/85 p-6 text-center">
            <div className="mb-4 flex items-center justify-between text-[10px] tracking-[0.25em] text-neon-red/70">
              <span>ALERTE SYSTÈME</span>
              <span>POT DE COLLE // ACTIF</span>
            </div>
            <p className="glitch-text text-3xl font-bold tracking-[0.1em] text-neon-red uppercase">
              Persona Piégé
            </p>
            <div className="mx-auto my-4 h-px max-w-xs bg-neon-red/30" />
            <p className="mt-3 text-xs leading-6 text-ink">
              Votre avatar matriciel a été verrouillé par une <span className="text-neon-red font-semibold">GLACE Pot de colle</span>.
            </p>
            <div className="my-4 rounded border border-neon-red/20 bg-neon-red/5 p-3 text-left text-xs leading-5">
              <p className="text-neon-red font-semibold mb-1">🚫 CONTRE-MESURES EN PLACE :</p>
              <ul className="list-disc pl-4 space-y-1 text-ink-dim">
                <li><span className="text-neon-red">Déconnexion impossible</span> (interdite par le système).</li>
                <li><span className="text-neon-red">Reboot du deck impossible</span> (Surveillance bloquée).</li>
              </ul>
            </div>
            <p className="text-xs leading-5 text-ink-dim">
              Utilisez l'action <span className="text-neon-cyan font-semibold">« S'arracher au Pot de colle »</span> (test de Hacking) pour forcer le passage et vous libérer.
            </p>
            <button
              className="btn btn-red mt-6 w-full py-2 text-xs font-bold tracking-widest uppercase"
              onClick={() => setDismissedTrapped(true)}
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
