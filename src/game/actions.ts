import { ref, update } from 'firebase/database';
import { getDb } from '../firebase';
import { useNetworkStore } from '../store/network';
import { appendLog, setDeckerNode } from '../sync/write';
import { adjacentNodeIds } from './graph';

/**
 * Action Scanner (Phase 1, provisoire) : révèle les nœuds `hidden` adjacents
 * au nœud courant du decker (hidden → spotted), sans jet.
 * TODO Phase 2 : brancher sur le moteur de jets (Perception matricielle,
 * Logique + Électronique) au lieu d'une révélation automatique.
 */
export async function performScan(code: string): Promise<number> {
  const { deckerNodeId, nodes, links } = useNetworkStore.getState();
  if (!deckerNodeId) return 0;

  const revealed = [...adjacentNodeIds(deckerNodeId, links)].filter(
    (id) => nodes[id]?.state === 'hidden',
  );
  if (revealed.length > 0) {
    const updates: Record<string, string> = {};
    for (const id of revealed) {
      updates[`network/nodes/${id}/state`] = 'spotted';
    }
    await update(ref(getDb(), `sessions/${code}`), updates);
  }
  const hereNode = nodes[deckerNodeId];
  // Le label d'un nœud seulement « spotted » n'est pas connu du decker (fog).
  const here = hereNode && hereNode.state !== 'spotted' ? hereNode.label : '???';
  await appendLog(
    code,
    'action',
    revealed.length > 0
      ? `Scan depuis « ${here} » : ${revealed.length} nœud(s) détecté(s).`
      : `Scan depuis « ${here} » : rien de nouveau.`,
  );
  return revealed.length;
}

/**
 * Déplacement du persona vers un nœud adjacent non-hidden.
 * TODO Phase 2 : exiger ≥ 1 Mark sur le nœud de destination.
 */
export async function moveDeckerTo(code: string, targetNodeId: string): Promise<boolean> {
  const { deckerNodeId, nodes, links } = useNetworkStore.getState();
  if (!deckerNodeId || deckerNodeId === targetNodeId) return false;
  const target = nodes[targetNodeId];
  if (!target || target.state === 'hidden') return false;
  if (!adjacentNodeIds(deckerNodeId, links).has(targetNodeId)) return false;

  await setDeckerNode(code, targetNodeId);
  const targetLabel = target.state !== 'spotted' ? target.label : '???';
  await appendLog(code, 'action', `Persona déplacé vers « ${targetLabel} ».`);
  return true;
}
