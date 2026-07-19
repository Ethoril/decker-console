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
  const deepest = [...contentNodeIds].sort((a, b) => nodes[b].x - nodes[a].x)[0] ?? 'gateway';
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

const randomInt = (min: number, max: number, random: () => number) =>
  Math.floor(random() * (max - min + 1)) + min;

function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomInt(0, index, random);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** Générateur local sans IA : chaque appel produit une nouvelle topologie. */
export function generateNetwork(
  counts: GeneratorCounts,
  difficulty: GeneratorDifficulty,
  random: () => number = Math.random,
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
  const instances = shuffle(
    GENERATOR_ITEMS.flatMap((item) => {
      const count = Math.max(0, Math.floor(counts[item.id] ?? 0));
      return Array.from({ length: count }, (_, index) => ({ item, instance: index + 1, count }));
    }),
    random,
  );
  const maximumBranches = Math.min(4, instances.length);
  const minimumBranches = instances.length >= 4 ? 2 : 1;
  const branchCount = randomInt(minimumBranches, maximumBranches, random);
  const lanes = Array.from(
    { length: branchCount },
    (_, index) => branchCount === 1 ? 280 : 80 + (400 * index) / (branchCount - 1),
  );
  const branchEnds = Array.from({ length: branchCount }, () => 'gateway');
  const branchDepths = Array.from({ length: branchCount }, () => 0);
  const branchNodes = Array.from({ length: branchCount }, () => [] as string[]);
  const branchByNode = new Map<string, number>();
  const sideLeaves = new Map<string, number>();
  let linkIndex = 2;
  const contentNodeIds: string[] = [];

  for (const [itemIndex, { item, instance, count }] of instances.entries()) {
    const branch = itemIndex < branchCount ? itemIndex : randomInt(0, branchCount - 1, random);
    const canMakeDeadEnd = branchNodes[branch].length >= 2;
    const deadEnd = itemIndex >= branchCount && canMakeDeadEnd && random() < 0.3;
    const parent = deadEnd
      ? branchNodes[branch][randomInt(0, branchNodes[branch].length - 2, random)]
      : branchEnds[branch];
    const nodeId = `${item.id}_${instance}`;
    const parentNode = nodes[parent];
    let x: number;
    let y: number;

    if (deadEnd) {
      const leafNumber = (sideLeaves.get(parent) ?? 0) + 1;
      sideLeaves.set(parent, leafNumber);
      x = parentNode.x + 125 + Math.floor((leafNumber - 1) / 2) * 35;
      y = parentNode.y + (leafNumber % 2 === 0 ? -55 : 55);
    } else {
      branchDepths[branch] += 1;
      x = 240 + branchDepths[branch] * 190;
      y = lanes[branch] + randomInt(-22, 22, random);
      branchEnds[branch] = nodeId;
    }

    nodes[nodeId] = {
      label: count > 1 ? `${item.label} ${instance}` : item.label,
      type: item.type,
      x,
      y,
      security: clampSecurity(baseSecurity + item.securityOffset + Math.floor((x - 240) / 380)),
      state: 'hidden',
      marks: 0,
      ...(item.deviceInfo ? { deviceInfo: item.deviceInfo } : {}),
      ...(item.paydata ? { paydata: item.paydata } : {}),
    };
    contentNodeIds.push(nodeId);
    branchNodes[branch].push(nodeId);
    branchByNode.set(nodeId, branch);
    links[`link_${linkIndex}`] = { from: parent, to: nodeId };
    linkIndex += 1;
  }

  // Certaines variantes reçoivent une ou deux passerelles entre axes.
  const crossLinkAttempts = instances.length >= 4 && random() < 0.45
    ? 1 + (instances.length >= 8 && random() < 0.4 ? 1 : 0)
    : 0;
  const linkedPairs = new Set(Object.values(links).map((link) => [link.from, link.to].sort().join('|')));
  for (let crossLink = 0; crossLink < crossLinkAttempts; crossLink += 1) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const from = contentNodeIds[randomInt(0, contentNodeIds.length - 1, random)];
      const to = contentNodeIds[randomInt(0, contentNodeIds.length - 1, random)];
      const pair = [from, to].sort().join('|');
      if (from !== to && branchByNode.get(from) !== branchByNode.get(to) && !linkedPairs.has(pair)) {
        links[`link_${linkIndex}`] = { from, to };
        linkedPairs.add(pair);
        linkIndex += 1;
        break;
      }
    }
  }

  return {
    network: { nodes, links },
    icons: generateSecurityIcons(difficulty, nodes, contentNodeIds),
    decker: { nodeId: 'entry' },
  };
}
