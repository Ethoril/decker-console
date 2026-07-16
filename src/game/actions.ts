import { ref, update } from 'firebase/database';
import { getDb } from '../firebase';
import { PERSONA } from '../data/persona';
import { marksFromSuccesses } from '../data/security';
import { deckerDefaults, useNetworkStore } from '../store/network';
import { appendLog, publishRoll, setDeckerNode, updateDecker, updateIcon } from '../sync/write';
import type { ConnectionMode, RollRecord } from '../types';
import { adjacentNodeIds } from './graph';

/** Label d'un nœud tel que le decker le connaît (fog : « ??? » si spotted). */
export function knownLabel(nodeId: string | null | undefined): string {
  if (!nodeId) return '???';
  const node = useNetworkStore.getState().nodes[nodeId];
  if (!node || node.state === 'spotted' || node.state === 'hidden') return '???';
  return node.label;
}

/** Publie un jet : miroir MJ (lastRoll), log résumé, alerte MJ sur complication. */
export async function publishRollAndLog(code: string, roll: RollRecord): Promise<void> {
  await publishRoll(code, roll);
  await appendLog(
    code,
    'roll',
    `${roll.action} : ${roll.successes} succès (${roll.pool}D, ${roll.successOn}+)` +
      `${roll.luckUsed ? ' 🍀' : ''}${roll.rerolled ? ' ↻' : ''} — ${roll.outcome}`,
  );
  if (roll.complication === 1) {
    // Le dé de complication reste invisible du joueur (CDC §3.3).
    await appendLog(
      code,
      'gm',
      `⚠ Dé de complication : 1 sur « ${roll.action} » — proposition +1 Surveillance (jauge en Phase 3).`,
      'gm',
    );
  }
}

// ------------------------------------------------------------------ scanner

/**
 * Applique le résultat d'un jet de Perception matricielle (scan des environs) :
 * ≥ 1 succès → les nœuds `hidden` adjacents passent en `spotted`.
 * Retourne le nombre de nœuds révélés (résumé d'effet).
 */
export async function applyScan(code: string, successes: number): Promise<string> {
  const { decker, nodes, links } = useNetworkStore.getState();
  if (!decker.nodeId) return 'aucun effet';
  if (successes < 1) return 'échec, rien détecté';

  const revealed = [...adjacentNodeIds(decker.nodeId, links)].filter(
    (id) => nodes[id]?.state === 'hidden',
  );
  if (revealed.length > 0) {
    const updates: Record<string, string> = {};
    for (const id of revealed) updates[`network/nodes/${id}/state`] = 'spotted';
    await update(ref(getDb(), `sessions/${code}`), updates);
  }
  return revealed.length > 0
    ? `${revealed.length} nœud(s) détecté(s)`
    : 'rien de nouveau à détecter';
}

/**
 * Analyse d'une GLACE visible : ≥ 2 succès → type révélé (`revealed: true`).
 * NB : seule écriture du joueur sur icons/ — c'est l'effet mécanique de son scan.
 */
export async function applyIceAnalysis(
  code: string,
  iconId: string,
  successes: number,
): Promise<string> {
  if (successes < 2) return 'échec, GLACE non identifiée';
  await updateIcon(code, iconId, { revealed: true });
  const icon = useNetworkStore.getState().icons[iconId];
  return `GLACE identifiée : ${icon?.iceType ?? 'type non défini par le MJ'}`;
}

// -------------------------------------------------------------------- hack

export type HackApproach = 'bruteForce' | 'corruption';

export const APPROACH_LABELS: Record<HackApproach, string> = {
  bruteForce: 'Force Brute',
  corruption: 'Corruption',
};

/**
 * Applique le résultat d'un jet de hack (CDC §3.4.3 et §3.4.6) :
 * - ≥ 2 succès → Marks selon la table, nœud infiltré.
 * - échec : Corruption → nœud en alerte (decker détecté) ;
 *           Force Brute → dégâts au decker (résolution MJ en Phase 2).
 */
export async function applyHack(
  code: string,
  nodeId: string,
  approach: HackApproach,
  successes: number,
): Promise<string> {
  const node = useNetworkStore.getState().nodes[nodeId];
  if (!node) return 'nœud disparu';
  const gained = marksFromSuccesses(successes);

  if (gained > 0) {
    const marks = Math.max(node.marks, gained);
    await update(ref(getDb(), `sessions/${code}/network/nodes/${nodeId}`), {
      marks,
      // Un nœud déjà en alerte le reste ; sinon il passe en infiltré.
      state: node.state === 'alerted' ? 'alerted' : 'infiltrated',
    });
    return `${marks} Mark(s) sur « ${node.label} »`;
  }

  if (approach === 'corruption') {
    await update(ref(getDb(), `sessions/${code}/network/nodes/${nodeId}`), {
      state: 'alerted',
    });
    await appendLog(
      code,
      'alert',
      `Corruption échouée : « ${node.label} » passe en ALERTE — decker détecté.`,
    );
    return 'échec — nœud en alerte';
  }
  // Force Brute : dégâts = succès excédentaires du système (jet MJ, automatisé en Phase 3).
  await appendLog(
    code,
    'gm',
    `Force Brute échouée sur « ${node.label} » (sécurité ${node.security}) : ` +
      `résolvez les dégâts au decker (succès excédentaires du système).`,
    'gm',
  );
  return 'échec — le système riposte';
}

// -------------------------------------------------------- droits par Mark

/** Lecture du paydata (≥ 2 Marks). Retourne le contenu, loggé. */
export async function readPaydata(code: string, nodeId: string): Promise<string | null> {
  const node = useNetworkStore.getState().nodes[nodeId];
  if (!node || node.marks < 2 || !node.paydata) return null;
  await appendLog(code, 'action', `Paydata lu sur « ${node.label} ».`);
  return node.paydata;
}

/** Contrôle de périphérique (≥ 3 Marks). Retourne le descriptif, loggé. */
export async function controlDevice(code: string, nodeId: string): Promise<string | null> {
  const node = useNetworkStore.getState().nodes[nodeId];
  if (!node || node.marks < 3 || !node.deviceInfo) return null;
  await appendLog(
    code,
    'action',
    `Contrôle de périphérique sur « ${node.label} » : ${node.deviceInfo}`,
  );
  return node.deviceInfo;
}

// ------------------------------------------------------------- déplacement

/** Déplacement vers un nœud adjacent, non-hidden, avec ≥ 1 Mark (CDC §3.4.4). */
export function canMoveTo(targetNodeId: string): { ok: boolean; reason: string | null } {
  const { decker, nodes, links } = useNetworkStore.getState();
  if (!decker.nodeId || decker.nodeId === targetNodeId)
    return { ok: false, reason: null };
  const target = nodes[targetNodeId];
  if (!target || target.state === 'hidden') return { ok: false, reason: null };
  if (!adjacentNodeIds(decker.nodeId, links).has(targetNodeId))
    return { ok: false, reason: 'Nœud non adjacent.' };
  if (target.marks < 1)
    return { ok: false, reason: 'Il faut ≥ 1 Mark sur le nœud pour s’y déplacer.' };
  return { ok: true, reason: null };
}

export async function moveDeckerTo(code: string, targetNodeId: string): Promise<boolean> {
  if (!canMoveTo(targetNodeId).ok) return false;
  await setDeckerNode(code, targetNodeId);
  await appendLog(code, 'action', `Persona déplacé vers « ${knownLabel(targetNodeId)} ».`);
  return true;
}

// ------------------------------------------------------------------- modes

export const MODE_LABELS: Record<ConnectionMode, string> = {
  AR: 'RA',
  VR: 'RV',
  HOTSIM: 'Hot-Sim',
};

/**
 * Changement de mode de connexion. Écorché : +2 cases Étourdissant à chaque
 * connexion RV/Hot-Sim depuis la RA (CDC §3.5) — la confirmation est côté UI.
 */
export async function setConnectionMode(
  code: string,
  newMode: ConnectionMode,
): Promise<void> {
  const { decker } = useNetworkStore.getState();
  const current = decker.mode ?? deckerDefaults.mode;
  if (current === newMode) return;

  const ecorche = current === 'AR' && newMode !== 'AR';
  await updateDecker(code, {
    mode: newMode,
    ...(ecorche
      ? { stun: (decker.stun ?? deckerDefaults.stun) + PERSONA.traits.ecorche }
      : {}),
  });
  await appendLog(
    code,
    'action',
    `Mode de connexion : ${MODE_LABELS[newMode]}.` +
      (ecorche ? ` Écorché : +${PERSONA.traits.ecorche} Étourdissant.` : ''),
  );
}

/** Recharge de la Chance par le MJ (début de séance). */
export async function rechargeLuck(code: string): Promise<void> {
  await updateDecker(code, { luck: PERSONA.chance });
  await appendLog(code, 'system', `Chance rechargée (${PERSONA.chance} points).`);
}

/** Dépense d'un point de Chance (au lancement du jet). */
export async function spendLuck(code: string): Promise<void> {
  const { decker } = useNetworkStore.getState();
  const luck = decker.luck ?? deckerDefaults.luck;
  if (luck > 0) await updateDecker(code, { luck: luck - 1 });
}
