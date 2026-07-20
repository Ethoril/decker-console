import { useEffect, useMemo, useState, useRef } from 'react';
import NetworkMap, { type MapSelection } from '../components/map/NetworkMap';
import { ICE_LABELS, NODE_TYPE_LABELS } from '../components/map/shapes';
import { ICE_EFFECTS, ICE_STATS } from '../data/ice';
import { DieuDial, MonitorBoxes } from '../components/decker/Monitors';
import { RollModal, type RollRequest } from '../components/decker/RollModal';
import { PresenceDot, SideColumn, useIsShort } from '../components/ui';
import { SoundToggle } from '../components/SoundToggle';
import { PERSONA } from '../data/persona';
import { MARK_RIGHTS } from '../data/security';
import {
  APPROACH_LABELS,
  applyHack,
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
import type { AttackEvent, Link, MatrixIcon, NetworkNode } from '../types';

/** Traduit un événement d'attaque structuré en libellé pour la popup joueur. */
function describeAttack(a: AttackEvent): string {
  const detail = a.detail ? ` (${a.detail})` : '';
  switch (a.outcome) {
    case 'dodged':
      return `Attaque esquivée${detail}`;
    case 'blocked':
      return `Bloqué par le Firewall${detail}`;
    case 'deckDamage':
      return `${a.amount ?? 0} dégât(s) au deck${detail}`;
    case 'physicalDamage':
      return `${a.amount ?? 0} dégât(s) physique(s)${detail}`;
    case 'convergence':
      return `${a.amount ?? 0} dégât(s) au deck — éjection`;
  }
}

export default function DeckerView() {
  const code = useSessionStore((s) => s.code)!;
  const leave = useSessionStore((s) => s.leave);
  const { meta, nodes, links, icons, decker, environment, log, lastAttack, lastAttackHydrated } =
    useNetworkStore();
  const short = useIsShort();

  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [roll, setRoll] = useState<RollRequest | null>(null);
  const [approachPick, setApproachPick] = useState(false);
  const [unlockedFeatures, setUnlockedFeatures] = useState<string[]>([]);
  const [revealedInfo, setRevealedInfo] = useState<{
    kind: 'paydata' | 'device';
    nodeLabel: string;
    text: string;
  } | null>(null);
  const [dismissedTrapped, setDismissedTrapped] = useState(false);

  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [activeAttack, setActiveAttack] = useState<{ attacker: string; result: string } | null>(null);

  // Surveillance alert popup
  const prevSurveillance = useRef<number | null>(null);
  const [surveillanceAlert, setSurveillanceAlert] = useState<{ from: number; to: number } | null>(null);
  const [rebootConfirmOpen, setRebootConfirmOpen] = useState(false);
  const [autoMoveConfirm, setAutoMoveConfirm] = useState<{ nodeId: string; label: string } | null>(null);

  useEffect(() => {
    const current = decker.surveillance ?? 0;
    if (prevSurveillance.current === null) {
      if (decker.surveillance === undefined) return;
      prevSurveillance.current = current;
      return;
    }
    if (current > prevSurveillance.current) {
      setSurveillanceAlert({ from: prevSurveillance.current, to: current });
    }
    prevSurveillance.current = current;
  }, [decker.surveillance]);

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

  // Alerte bandeau rouge quand un nœud passe en alerte
  const prevAlertedNodes = useRef<Set<string> | null>(null);
  useEffect(() => {
    const alertedIds = Object.entries(nodes)
      .filter(([, node]) => node.state === 'alerted')
      .map(([id]) => id);

    // Armement à la première hydratation non vide : évite de rejouer les
    // alertes déjà existantes lors d'un rechargement de page (le store est
    // vide au montage puis peuplé de façon asynchrone par Firebase).
    if (prevAlertedNodes.current === null) {
      if (Object.keys(nodes).length === 0) return;
      prevAlertedNodes.current = new Set(alertedIds);
      return;
    }

    const newlyAlerted = alertedIds.find((id) => !prevAlertedNodes.current!.has(id));
    if (newlyAlerted) {
      const nodeLabel = nodes[newlyAlerted]?.label || 'Nœud inconnu';
      setActiveAlert(`ALERTE SYSTÈME : Nœud « ${nodeLabel} » compromis !`);
    }
    prevAlertedNodes.current = new Set(alertedIds);
  }, [nodes]);

  // Ferme l'alerte de nœud après 4 secondes
  useEffect(() => {
    if (activeAlert) {
      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [activeAlert]);

  // Popup quand le decker est attaqué. Piloté par le canal structuré
  // `lastAttack` (écrit par game/threat.ts à la source) : plus de parsing du
  // journal, donc plus de faux positifs sur les actions du decker.
  const seenAttackId = useRef<string | null>(null);
  useEffect(() => {
    // On attend l'hydratation réelle du canal (pas la simple absence de valeur)
    // pour ne pas confondre « store pas encore chargé » et « aucune attaque ».
    if (!lastAttackHydrated) return;
    // Premier passage après hydratation : on mémorise l'état courant sans
    // afficher — attaque déjà présente au rechargement (anti-rejeu), ou absence
    // d'attaque (on s'arme pour la prochaine, marquée par la sentinelle '').
    if (seenAttackId.current === null) {
      seenAttackId.current = lastAttack ? lastAttack.id : '';
      return;
    }
    if (!lastAttack || lastAttack.id === seenAttackId.current) return;
    seenAttackId.current = lastAttack.id;
    setActiveAttack({
      attacker: lastAttack.attacker,
      result: describeAttack(lastAttack),
    });
  }, [lastAttack, lastAttackHydrated]);

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
      forcedMinigame: target.forcedMinigame ?? null,
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

  const doReadPaydata = async () => {
    if (!deckerNodeId || !currentNode) return;
    const text = await readPaydata(code, deckerNodeId);
    if (text) setRevealedInfo({ kind: 'paydata', nodeLabel: knownLabel(deckerNodeId), text });
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
    
    // Détection des déblocages
    if (node && node.marks > marksBefore) {
      const newlyUnlocked: string[] = [];
      if (marksBefore < 2 && node.marks >= 2 && node.paydata) {
        newlyUnlocked.push('Paydata décrypté');
      }
      if (marksBefore < 3 && node.marks >= 3 && node.deviceInfo) {
        newlyUnlocked.push('Accès périphérique obtenu');
      }
      if (newlyUnlocked.length > 0) {
        setUnlockedFeatures(newlyUnlocked);
      }
    }

    // On ne propose le déplacement que si CE hack a réellement gagné un Mark
    // (évite un « Hack réussi » trompeur sur un re-hack raté ou une annulation).
    if (node && node.marks > marksBefore && canMoveTo(targetNodeId).ok) {
      setAutoMoveConfirm({ nodeId: targetNodeId, label: knownLabel(targetNodeId) });
    }
  };

  const doControlDevice = async () => {
    if (!deckerNodeId) return;
    const text = await controlDevice(code, deckerNodeId);
    if (text) setRevealedInfo({ kind: 'device', nodeLabel: knownLabel(deckerNodeId), text });
  };

  const doReboot = () => {
    if (trapped) return;
    setRebootConfirmOpen(true);
  };

  const confirmReboot = () => {
    setRebootConfirmOpen(false);
    void reboot(code);
  };

  const handleAutoMoveConfirm = (confirmed: boolean) => {
    if (confirmed && autoMoveConfirm) {
      void moveDeckerTo(code, autoMoveConfirm.nodeId);
    }
    setAutoMoveConfirm(null);
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
    <div className="flex h-full flex-col relative">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-grid bg-panel px-3">
        <span className="text-xs tracking-[0.2em] text-neon-cyan uppercase">Decker</span>
        <span className="glow-text text-sm tracking-[0.25em] text-neon-cyan">{code}</span>
        <PresenceDot connected={meta?.gmConnected ?? false} label="MJ" />
        <span className="text-[10px] text-ink-dim select-none ml-1 opacity-70 font-mono">
          {import.meta.env.VITE_APP_VERSION}
        </span>
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

      {/* Bandeau rouge Alerte Nœud (auto-dismissing, clignotant) */}
      {activeAlert && (
        <div className="absolute top-11 left-0 right-0 z-30 pulse-alert border-y border-neon-red bg-neon-red/15 py-3 text-center text-sm text-neon-red font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(255,59,92,0.25)]">
          {activeAlert}
        </div>
      )}

      {/* Bandeau d'Attaque (dismissible avec bouton OK) */}
      {activeAttack && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-[35] w-full max-w-sm border border-neon-red bg-panel p-4 shadow-[0_0_25px_rgba(255,59,92,0.5)] rounded">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs tracking-wider text-neon-red font-bold uppercase">
              <span>⚠ DÉTECTION D'ATTAQUE</span>
              <span className="text-[10px] opacity-70">SYSTÈMES DE SÉCURITÉ</span>
            </div>
            <div className="h-px bg-neon-red/30 my-1" />
            <p className="text-xs text-ink leading-5">
              Source de l'assaut : <span className="text-neon-cyan font-bold">{activeAttack.attacker}</span>
            </p>
            <p className="text-xs text-ink leading-5">
              Résultat : <span className="text-neon-red font-bold">{activeAttack.result}</span>
            </p>
            <button
              className="btn btn-red mt-2 w-full py-1 text-xs font-bold tracking-widest uppercase"
              onClick={() => setActiveAttack(null)}
            >
              OK (Fermer)
            </button>
          </div>
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
          />
          <div className="mt-2">
            <button
              className="btn w-full text-xs"
              disabled={rebooting || trapped}
              title={trapped ? 'Pot de colle : reboot impossible' : undefined}
              onClick={doReboot}
            >
              ⟳ Rebooter (Surveillance → 0, 3 tours)
            </button>
          </div>
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

            <button
              className="btn btn-cyan text-xs"
              disabled={actionsLocked || !hackTargetId || (hackTargetId ? nodes[hackTargetId]?.marks >= 4 : false)}
              onClick={() => setApproachPick(true)}
            >
              ⚡ Hacker {hackTargetId ? `« ${knownLabel(hackTargetId)} »` : ''}
            </button>

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

            {selectedIcon?.kind === 'ice' &&
              selectedIcon.iceType === 'traceuse' && (
                <button className="btn btn-magenta text-xs" disabled={actionsLocked} onClick={startJamming}>
                  ◌ Brouiller la Traceuse
                </button>
              )}

            <hr className="my-1 border-grid" />
            <h4 className="text-[10px] text-ink-dim uppercase tracking-wider mb-0.5">Acquisitions Automatiques</h4>
            <div className="flex flex-col gap-1.5 border border-grid p-2 rounded bg-panel-2">
              <button
                className={`text-left text-xs p-1.5 rounded border transition-colors flex items-center justify-between ${
                  currentNode && currentNode.marks >= 2 && currentNode.paydata
                    ? 'border-neon-green/50 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 cursor-pointer'
                    : 'border-transparent text-ink-dim opacity-50 cursor-not-allowed'
                }`}
                disabled={actionsLocked || !currentNode || currentNode.marks < 2 || !currentNode.paydata}
                onClick={doReadPaydata}
              >
                <span>▤ Décrypter le paydata</span>
                {!(currentNode && currentNode.marks >= 2)
                  ? <span className="text-[9px] opacity-70">(≥ 2 Marks)</span>
                  : !currentNode?.paydata && <span className="text-[9px] opacity-70">(aucune donnée)</span>}
              </button>
              
              <button
                className={`text-left text-xs p-1.5 rounded border transition-colors flex items-center justify-between ${
                  currentNode && currentNode.marks >= 3 && currentNode.deviceInfo
                    ? 'border-neon-green/50 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 cursor-pointer'
                    : 'border-transparent text-ink-dim opacity-50 cursor-not-allowed'
                }`}
                disabled={actionsLocked || !currentNode || currentNode.marks < 3 || !currentNode.deviceInfo}
                onClick={() => void doControlDevice()}
              >
                <span>⌘ Contrôler le périphérique</span>
                {!(currentNode && currentNode.marks >= 3)
                  ? <span className="text-[9px] opacity-70">(≥ 3 Marks)</span>
                  : !currentNode?.deviceInfo && <span className="text-[9px] opacity-70">(aucun périphérique)</span>}
              </button>
            </div>

            {trapped && (
              <>
                <hr className="my-1 border-grid" />
                <button className="btn btn-red text-xs" disabled={actionsLocked} onClick={startEscape}>
                  ⛓ S'arracher au Pot de colle
                </button>
              </>
            )}
          </div>

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
                <>
                  <p className="text-neon-red font-semibold">
                    GLACE — {selectedIcon.iceType ? ICE_LABELS[selectedIcon.iceType] : 'Non spécifiée'}
                  </p>
                  {selectedIcon.iceType && (
                    <div className="mt-2 border-t border-grid/40 pt-1.5 text-[11px] leading-4 text-ink-dim space-y-1">
                      <p>
                        <span className="font-semibold text-ink">Stats :</span> FW {ICE_STATS.firewall} · Logique {ICE_STATS.logique} · Attaque {ICE_STATS.attackPool}D
                        {ICE_EFFECTS[selectedIcon.iceType].attackBonus > 0 ? ` (+${ICE_EFFECTS[selectedIcon.iceType].attackBonus} Combat)` : ''} · Dégâts {ICE_STATS.baseDamage} {ICE_EFFECTS[selectedIcon.iceType].alwaysPhysical ? 'Physique' : 'Étourdissant'} · Condition {selectedIcon.condition}
                      </p>
                      {ICE_EFFECTS[selectedIcon.iceType].onHitText && (
                        <p>
                          <span className="font-semibold text-neon-red">Impact :</span>{' '}
                          {ICE_EFFECTS[selectedIcon.iceType].onHitText}
                        </p>
                      )}
                      {ICE_EFFECTS[selectedIcon.iceType].passiveText && (
                        <p>
                          <span className="font-semibold text-neon-cyan">Passif :</span>{' '}
                          {ICE_EFFECTS[selectedIcon.iceType].passiveText}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : selectedIcon.kind === 'spider' ? (
                <div className="space-y-1">
                  <p className="text-neon-amber font-semibold">Spider</p>
                  <p className="text-[11px] leading-4 text-ink-dim border-t border-grid/40 pt-1.5">
                    Hacker de sécurité humain patrouillant le réseau.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-neon-magenta font-semibold">Hacker ennemi</p>
                  <p className="text-[11px] leading-4 text-ink-dim border-t border-grid/40 pt-1.5">
                    Utilisateur hostile connecté au réseau.
                  </p>
                </div>
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

      {/* Modal de sélection de l'approche de Hacking */}
      {approachPick && hackTargetId && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-abyss/85 backdrop-blur-sm"
          onClick={() => setApproachPick(false)}
        >
          <div
            className="relative z-10 flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-grid bg-panel p-5 shadow-[0_0_40px_rgba(46,230,255,0.15)] max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Entête */}
            <div className="flex items-start justify-between border-b border-grid pb-3">
              <div>
                <span className="text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">Sélection de l'approche</span>
                <h2 className="text-base font-bold tracking-wider text-ink mt-1">
                  Hacker le nœud « {knownLabel(hackTargetId)} »
                </h2>
              </div>
              <button
                className="btn min-h-0 h-8 w-8 flex items-center justify-center px-0 py-0 text-sm border-grid text-ink-dim hover:text-ink hover:border-ink-dim"
                onClick={() => setApproachPick(false)}
              >
                ✕
              </button>
            </div>

            {/* Description générale */}
            <p className="text-xs text-ink-dim leading-relaxed">
              Choisissez la méthode pour infiltrer ce nœud (Sécurité <span className="text-neon-cyan font-bold">{nodes[hackTargetId]?.security}</span>).
              L'approche détermine le mini-jeu lancé après le jet de dés, ainsi que le type de représailles du système en cas d'échec.
            </p>

            {/* Cartes d'approche */}
            <div className="grid grid-cols-2 gap-4 my-1">
              {/* Carte Force Brute */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Hacker en Force Brute"
                className="group flex flex-col justify-between rounded-lg border border-neon-red/30 bg-panel-2 p-4 transition-all duration-300 hover:border-neon-red hover:bg-neon-red/5 hover:shadow-[0_0_15px_rgba(255,59,92,0.1)] cursor-pointer focus:outline-none focus-visible:[outline:2px_solid_var(--color-neon-red)] focus-visible:[outline-offset:2px]"
                onClick={() => startHack('bruteForce')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    startHack('bruteForce');
                  }
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-neon-red tracking-wider uppercase group-hover:glow-text">
                      💥 Force Brute
                    </h3>
                    <span className="text-[8px] px-1.5 py-0.5 rounded border border-neon-red/30 text-neon-red uppercase font-semibold">
                      Offensif
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-dim mb-3 leading-relaxed">
                    Surchargez les protocoles matriciels pour forcer l'accès. Rapide et destructeur.
                  </p>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <span className="text-neon-green">✓</span>
                      <span className="text-ink"><strong>Réussite</strong> : Obtention de Marks</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-neon-red">✗</span>
                      <span className="text-ink-dim group-hover:text-ink transition-colors">
                        <strong>Échec</strong> : Dégâts au Deck (RA) ou Physiques (RV)
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-neon-cyan">🎮</span>
                      <span className="text-ink-dim">
                        <strong>Mini-jeu</strong> : Surcharge (timing)
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className="btn btn-red mt-4 flex w-full items-center justify-center py-1 min-h-[32px] h-8 text-[10px] font-bold uppercase tracking-wider group-hover:bg-neon-red/10 transition-colors"
                >
                  Force Brute
                </span>
              </div>

              {/* Carte Corruption */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Hacker en Corruption"
                className="group flex flex-col justify-between rounded-lg border border-neon-magenta/30 bg-panel-2 p-4 transition-all duration-300 hover:border-neon-magenta hover:bg-neon-magenta/5 hover:shadow-[0_0_15px_rgba(255,46,196,0.1)] cursor-pointer focus:outline-none focus-visible:[outline:2px_solid_var(--color-neon-magenta)] focus-visible:[outline-offset:2px]"
                onClick={() => startHack('corruption')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    startHack('corruption');
                  }
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-neon-magenta tracking-wider uppercase group-hover:glow-text">
                      🕵️ Corruption
                    </h3>
                    <span className="text-[8px] px-1.5 py-0.5 rounded border border-neon-magenta/30 text-neon-magenta uppercase font-semibold">
                      Furtif
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-dim mb-3 leading-relaxed">
                    Exploitez discrètement des failles réseau. Subtil et furtif.
                  </p>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <span className="text-neon-green">✓</span>
                      <span className="text-ink"><strong>Réussite</strong> : Infiltration et Marks</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-neon-magenta">✗</span>
                      <span className="text-ink-dim group-hover:text-ink transition-colors">
                        <strong>Échec</strong> : Nœud en <strong>Alerte</strong> (contre-mesures)
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-neon-cyan">🎮</span>
                      <span className="text-ink-dim">
                        <strong>Mini-jeu</strong> : Injection de code (Mastermind)
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className="btn btn-magenta mt-4 flex w-full items-center justify-center py-1 min-h-[32px] h-8 text-[10px] font-bold uppercase tracking-wider group-hover:bg-neon-magenta/10 transition-colors"
                >
                  Corruption
                </span>
              </div>

            </div>

            {/* Pied de page d'annulation */}
            <div className="flex justify-end border-t border-grid pt-3">
              <button
                className="btn min-h-0 h-9 px-4 py-1.5 text-xs font-semibold hover:bg-panel-2"
                onClick={() => setApproachPick(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

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
            <p className="text-sm tracking-wider text-neon-red/90 uppercase font-bold">
              Position physique compromise — Système Grillé
            </p>
            
            <div className="my-5 mx-auto max-w-md rounded border border-neon-red/30 bg-neon-red/5 p-4 text-left text-xs leading-6">
              <p className="text-neon-red font-bold mb-2 uppercase tracking-wide">🚫 EFFETS DE LA CONVERGENCE :</p>
              <ul className="list-disc pl-4 space-y-2 text-ink">
                <li>
                  <span className="text-neon-red font-semibold">Dumpshock immédiat</span> : Vous subissez <span className="text-neon-red font-semibold">3 cases de dégâts Étourdissants</span> (éjection en RA).
                </li>
                <li>
                  <span className="text-neon-red font-semibold">Cyberdeck endommagé</span> : Votre appareil subit des dégâts matériels massifs (déterminés par le MJ).
                </li>
                <li>
                  <span className="text-neon-red font-semibold">Localisation compromise</span> : Le DIEU a tracé votre position physique réelle et alerté la sécurité locale.
                </li>
                <li>
                  <span className="text-neon-red font-semibold">Éjection de la Matrice</span> : Votre connexion est coupée de force, votre persona disparaît et votre console est verrouillée.
                </li>
              </ul>
            </div>

            <p className="mt-4 text-xs leading-6 text-ink-dim">
              La séquence matricielle est terminée. Le MJ reprend la main pour la narration physique.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-[10px] text-neon-red/60">
              <span className="border border-neon-red/20 p-2">DECK // LOCK</span>
              <span className="border border-neon-red/20 p-2">SIGNAL // LOST</span>
              <span className="border border-neon-red/20 p-2">GOD // ONLINE</span>
            </div>
          </div>
        </div>
      )}

      {/* Alerte d'augmentation de la surveillance (convergence et Pot de colle priment) */}
      {surveillanceAlert && !convergence && !(trapped && !dismissedTrapped) && (
        <div className="convergence-screen fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-5">
          <div className="convergence-frame relative w-full max-w-sm border border-neon-amber bg-abyss/85 p-6 text-center">
            <div className="mb-4 flex items-center justify-between text-[10px] tracking-[0.25em] text-neon-amber">
              <span>ALERTE DE TRAÇAGE</span>
              <span>DIEU // ACTIVE TRACE</span>
            </div>
            <p className="glitch-text text-2xl font-bold tracking-[0.1em] text-neon-amber uppercase">
              Le Signal s'échauffe
            </p>
            <div className="mx-auto my-4 h-px max-w-xs bg-neon-amber/30" />
            <p className="mt-3 text-xs leading-6 text-ink">
              Votre niveau de surveillance matricielle a augmenté :
            </p>
            <p className="text-xl font-bold text-neon-amber bg-panel-2 py-2 my-2 rounded">
              {surveillanceAlert.from} ➔ {surveillanceAlert.to} / 6
            </p>
            <p className="text-xs leading-5 text-ink-dim mt-4">
              Rapprochez-vous de la déconnexion ou effectuez un <span className="text-neon-cyan font-semibold">Reboot</span> avant que le DIEU ne converge (à 6/6) !
            </p>
            <button
              className="btn btn-cyan mt-6 w-full py-2 text-xs font-bold tracking-widest uppercase"
              onClick={() => setSurveillanceAlert(null)}
            >
              Compris
            </button>
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

      {/* Modal des nouvelles acquisitions */}
      {unlockedFeatures.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-abyss/85 backdrop-blur-sm"
          onClick={() => setUnlockedFeatures([])}
        >
          <div
            className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-lg border border-neon-green bg-panel p-5 shadow-[0_0_40px_rgba(46,255,100,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center mb-2">
              <span className="text-3xl">🔓</span>
            </div>
            <h2 className="text-center text-lg font-bold tracking-wider text-neon-green uppercase">
              Accès déverrouillé
            </h2>
            <div className="space-y-3 mt-2 text-sm text-ink text-center">
              {unlockedFeatures.map((f, i) => (
                <p key={i} className="font-semibold text-neon-cyan">{f}</p>
              ))}
            </div>
            <button
              className="btn btn-cyan mt-4 w-full py-2 text-xs font-bold tracking-widest uppercase"
              onClick={() => setUnlockedFeatures([])}
            >
              Consulter
            </button>
          </div>
        </div>
      )}

      {/* Popup d'explication de l'élément consulté */}
      {revealedInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-abyss/85 backdrop-blur-sm"
          onClick={() => setRevealedInfo(null)}
        >
          <div
            className="relative z-10 flex w-full max-w-sm flex-col gap-3 rounded-lg border border-neon-green bg-panel p-5 shadow-[0_0_40px_rgba(46,255,100,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center">
              <span className="text-3xl">{revealedInfo.kind === 'paydata' ? '▤' : '⌘'}</span>
            </div>
            <h2 className="text-center text-lg font-bold tracking-wider text-neon-green uppercase">
              {revealedInfo.kind === 'paydata' ? 'Paydata décryptée' : 'Périphérique sous contrôle'}
            </h2>
            <p className="text-center text-[11px] text-ink-dim">
              {revealedInfo.kind === 'paydata'
                ? `Les données confidentielles du nœud « ${revealedInfo.nodeLabel} » sont désormais lisibles :`
                : `Vous pilotez à présent le périphérique rattaché au nœud « ${revealedInfo.nodeLabel} » :`}
            </p>
            <div className="rounded border border-neon-green/40 bg-panel-2 p-3 text-sm leading-5 text-neon-green">
              {revealedInfo.text}
            </div>
            <button
              className="btn btn-cyan mt-2 w-full py-2 text-xs font-bold tracking-widest uppercase"
              onClick={() => setRevealedInfo(null)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Pop-up Rebooter Surveillance stylé */}
      {rebootConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 backdrop-blur-sm p-5">
          <div className="relative w-full max-w-sm border border-neon-cyan bg-panel p-5 rounded shadow-[0_0_25px_rgba(46,230,255,0.25)] text-center">
            <div className="mb-4 flex items-center justify-between text-[10px] tracking-[0.25em] text-neon-cyan uppercase font-bold">
              <span>Reboot console</span>
              <span>Système</span>
            </div>
            <p className="glitch-text text-xl font-bold tracking-wider text-neon-cyan uppercase">
              Rebooter le deck ?
            </p>
            <div className="mx-auto my-4 h-px max-w-xs bg-neon-cyan/30" />
            <p className="text-xs leading-5 text-ink mb-6">
              La surveillance matricielle sera purgée (remise à 0), mais votre console sera inactive pendant <span className="text-neon-amber font-semibold">3 tours</span>.
            </p>
            <div className="flex gap-3">
              <button
                className="btn flex-1 text-xs hover:bg-panel-2"
                onClick={() => setRebootConfirmOpen(false)}
              >
                Annuler
              </button>
              <button
                className="btn btn-cyan flex-1 text-xs font-bold"
                onClick={confirmReboot}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Déplacement Auto stylé */}
      {autoMoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 backdrop-blur-sm p-5">
          <div className="relative w-full max-w-sm border border-neon-green bg-panel p-5 rounded shadow-[0_0_25px_rgba(58,255,143,0.25)] text-center">
            <div className="mb-4 flex items-center justify-between text-[10px] tracking-[0.25em] text-neon-green uppercase font-bold">
              <span>Accès autorisé</span>
              <span>Déplacement</span>
            </div>
            <p className="glitch-text text-xl font-bold tracking-wider text-neon-green uppercase">
              Hack réussi !
            </p>
            <div className="mx-auto my-4 h-px max-w-xs bg-neon-green/30" />
            <p className="text-xs leading-5 text-ink mb-6">
              Voulez-vous vous déplacer sur le nœud « <span className="text-neon-green font-semibold">{autoMoveConfirm.label}</span> » ?
            </p>
            <div className="flex gap-3">
              <button
                className="btn flex-1 text-xs hover:bg-panel-2"
                onClick={() => handleAutoMoveConfirm(false)}
              >
                Rester ici
              </button>
              <button
                className="btn btn-cyan flex-1 text-xs font-bold"
                onClick={() => handleAutoMoveConfirm(true)}
              >
                Se déplacer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
