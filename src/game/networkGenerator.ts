import type { MatrixIcon, NetworkExport, NetworkNode, NodeType } from '../types';

export type GeneratorDifficulty = 'low' | 'standard' | 'high';

export interface GeneratorItem {
  id: string;
  label: string;
  type: NodeType;
  securityOffset: number;
  deviceInfo?: string;
  paydata?: string;
}

export const GENERATOR_ITEMS: GeneratorItem[] = [
  { id: 'cameras', label: 'Caméras', type: 'device', securityOffset: 0, deviceInfo: 'Flux, orientation et archives des caméras.' },
  { id: 'turrets', label: 'Tourelles', type: 'device', securityOffset: 1, deviceInfo: 'Ciblage, verrouillage et commande de tir des tourelles.' },
  { id: 'pressure', label: 'Capteurs de pression', type: 'device', securityOffset: 0, deviceInfo: 'État et zones couvertes par les capteurs de pression.' },
  { id: 'lasers', label: 'Lasers', type: 'device', securityOffset: 1, deviceInfo: 'Grille laser, alimentation et séquences de coupure.' },
  { id: 'mad', label: 'Portiques MAD', type: 'device', securityOffset: 1, deviceInfo: 'Détection d’armes et journal des passages.' },
  { id: 'retina', label: 'Scanner rétinien', type: 'device', securityOffset: 1, deviceInfo: 'Profils autorisés et contrôle du scanner rétinien.' },
  { id: 'maglocks', label: 'Serrures Maglock', type: 'device', securityOffset: 1, deviceInfo: 'Verrouillage et autorisations des serrures Maglock.' },
  { id: 'infrared', label: 'Détecteurs infrarouges', type: 'device', securityOffset: 0, deviceInfo: 'Couverture thermique et alertes des détecteurs infrarouges.' },
  { id: 'drones', label: 'Drones', type: 'device', securityOffset: 1, deviceInfo: 'Ordres, itinéraires et contrôle des drones.' },
  { id: 'data', label: 'Caches de données', type: 'archive', securityOffset: 1, paydata: 'Données dissimulées dans cette cache.' },
  { id: 'cryptodollars', label: 'CryptoDollars', type: 'database', securityOffset: 2, paydata: 'Portefeuille de CryptoDollars et clés de transfert.' },
];

export type GeneratorCounts = Record<string, number>;

const BASE_SECURITY: Record<GeneratorDifficulty, number> = {
  low: 2,
  standard: 4,
  high: 6,
};

const clampSecurity = (value: number) => Math.max(1, Math.min(10, value));

function generateSecurityIcons(
  difficulty: GeneratorDifficulty,
  nodes: Record<string, NetworkNode>,
  contentNodeIds: string[],
): Record<string, MatrixIcon> {
  const rankedTargets = [...contentNodeIds].sort((a, b) => {
    const securityDifference = nodes[b].security - nodes[a].security;
    return securityDifference || a.localeCompare(b);
  });
  const strongest = rankedTargets[0] ?? 'gateway';
  const deepest = contentNodeIds.at(-1) ?? 'gateway';
  const middle = contentNodeIds[Math.floor(contentNodeIds.length / 2)] ?? strongest;

  const icons: Record<string, MatrixIcon> = {
    patrol: {
      kind: 'ice', nodeId: 'gateway', iceType: 'patrouilleuse',
      revealed: false, visibleToPlayer: true, label: 'Sentinelle', condition: 6,
    },
  };

  if (difficulty !== 'low') {
    icons.blocker = {
      kind: 'ice', nodeId: strongest, iceType: 'bloqueuse',
      revealed: false, visibleToPlayer: false, label: 'Verrou', condition: 6,
    };
  }

  if (difficulty === 'high') {
    icons.tracer = {
      kind: 'ice', nodeId: middle, iceType: 'traceuse',
      revealed: false, visibleToPlayer: false, label: 'Limier', condition: 6,
    };
    icons.tar = {
      kind: 'ice', nodeId: deepest, iceType: 'potDeColle',
      revealed: false, visibleToPlayer: false, label: 'Goudron', condition: 6,
    };
    icons.killer = {
      kind: 'ice', nodeId: strongest, iceType: 'tueuse',
      revealed: false, visibleToPlayer: false, label: 'Cerbère', condition: 8,
    };
    icons.spider = {
      kind: 'spider', nodeId: strongest, iceType: null,
      revealed: true, visibleToPlayer: false, label: 'Spider de sécurité',
      condition: 8, atkPool: 13, defPool: 11,
    };
  }

  return icons;
}

/**
 * Générateur local sans IA et sans hasard : les mêmes entrées produisent
 * strictement le même graphe à trois branches.
 */
export function generateNetwork(
  counts: GeneratorCounts,
  difficulty: GeneratorDifficulty,
): NetworkExport {
  const baseSecurity = BASE_SECURITY[difficulty];
  const nodes: Record<string, NetworkNode> = {
    entry: {
      label: 'Point d’accès', type: 'entry', x: 70, y: 280,
      security: clampSecurity(baseSecurity - 1), state: 'infiltrated', marks: 1,
    },
    gateway: {
      label: 'Passerelle de sécurité', type: 'firewall', x: 240, y: 280,
      security: clampSecurity(baseSecurity), state: 'spotted', marks: 0,
    },
  };
  const links: NetworkExport['network']['links'] = {
    link_1: { from: 'entry', to: 'gateway' },
  };
  const branchEnds = ['gateway', 'gateway', 'gateway'];
  const branchDepths = [0, 0, 0];
  const lanes = [100, 280, 460];
  let itemIndex = 0;
  let linkIndex = 2;
  const contentNodeIds: string[] = [];

  for (const item of GENERATOR_ITEMS) {
    const count = Math.max(0, Math.floor(counts[item.id] ?? 0));
    for (let instance = 1; instance <= count; instance += 1) {
      const branch = itemIndex % 3;
      const nodeId = `${item.id}_${instance}`;
      branchDepths[branch] += 1;
      nodes[nodeId] = {
        label: count > 1 ? `${item.label} ${instance}` : item.label,
        type: item.type,
        x: 240 + branchDepths[branch] * 190,
        y: lanes[branch],
        security: clampSecurity(baseSecurity + item.securityOffset + Math.floor((branchDepths[branch] - 1) / 2)),
        state: 'hidden',
        marks: 0,
        ...(item.deviceInfo ? { deviceInfo: item.deviceInfo } : {}),
        ...(item.paydata ? { paydata: item.paydata } : {}),
      };
      contentNodeIds.push(nodeId);
      links[`link_${linkIndex}`] = { from: branchEnds[branch], to: nodeId };
      branchEnds[branch] = nodeId;
      itemIndex += 1;
      linkIndex += 1;
    }
  }

  return {
    network: { nodes, links },
    icons: generateSecurityIcons(difficulty, nodes, contentNodeIds),
    decker: { nodeId: 'entry' },
  };
}
