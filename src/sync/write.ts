import { get, push, ref, serverTimestamp, set, update } from 'firebase/database';
import { getDb } from '../firebase';
import { useNetworkStore } from '../store/network';
import { NETWORK_TEMPLATES } from '../data/networkTemplates';
import type {
  AttackEvent,
  DeckerState,
  EnvironmentState,
  IconKind,
  Link,
  LogKind,
  MatrixIcon,
  MiniGameState,
  NetworkExport,
  NetworkNode,
  NetworkPreset,
  NodeState,
  RollRecord,
} from '../types';

// Convention (cf. CDC §2) : uniquement des écritures ciblées (update/set sur
// chemins précis), jamais de set() global sur la session — évite les conflits
// entre les writes MJ et joueur.

const sessionPath = (code: string) => `sessions/${code}`;

// ---------------------------------------------------------------- sessions

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans O/0/I/1

function generateCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join('');
}

export async function sessionExists(code: string): Promise<boolean> {
  const snap = await get(ref(getDb(), `${sessionPath(code)}/meta`));
  return snap.exists();
}

export async function createSession(name: string): Promise<string> {
  const db = getDb();
  let code = generateCode();
  // Collision improbable (32^6) mais peu coûteuse à éviter.
  while (await sessionExists(code)) code = generateCode();
  await set(ref(db, `${sessionPath(code)}/meta`), {
    name: name || 'Session sans nom',
    createdAt: serverTimestamp(),
    gmConnected: false,
    deckerConnected: false,
  });
  return code;
}

// ------------------------------------------------------------------- nœuds

export async function createNode(
  code: string,
  node: NetworkNode,
): Promise<string> {
  const nodeRef = push(ref(getDb(), `${sessionPath(code)}/network/nodes`));
  await set(nodeRef, node);
  return nodeRef.key as string;
}

export async function updateNode(
  code: string,
  nodeId: string,
  partial: Partial<NetworkNode>,
): Promise<void> {
  await update(ref(getDb(), `${sessionPath(code)}/network/nodes/${nodeId}`), partial);
}

/** Supprime le nœud, ses liens et les icônes posées dessus (multi-path update). */
export async function deleteNode(code: string, nodeId: string): Promise<void> {
  const { links, icons, decker } = useNetworkStore.getState();
  const deckerNodeId = decker.nodeId ?? null;
  const updates: Record<string, null> = {
    [`network/nodes/${nodeId}`]: null,
  };
  for (const [linkId, link] of Object.entries(links)) {
    if (link.from === nodeId || link.to === nodeId) {
      updates[`network/links/${linkId}`] = null;
    }
  }
  for (const [iconId, icon] of Object.entries(icons)) {
    if (icon.nodeId === nodeId) updates[`icons/${iconId}`] = null;
  }
  if (deckerNodeId === nodeId) updates['decker/nodeId'] = null;
  await update(ref(getDb(), sessionPath(code)), updates);
}

export async function setNodeState(
  code: string,
  nodeId: string,
  state: NodeState,
): Promise<void> {
  await updateNode(code, nodeId, { state });
}

// ------------------------------------------------------------------- liens

export async function createLink(code: string, from: string, to: string): Promise<void> {
  const { links } = useNetworkStore.getState();
  const exists = Object.values(links).some(
    (l) => (l.from === from && l.to === to) || (l.from === to && l.to === from),
  );
  if (exists || from === to) return;
  const link: Link = { from, to };
  await set(push(ref(getDb(), `${sessionPath(code)}/network/links`)), link);
}

export async function deleteLink(code: string, linkId: string): Promise<void> {
  await set(ref(getDb(), `${sessionPath(code)}/network/links/${linkId}`), null);
}

// ------------------------------------------------------------------ icônes

export async function createIcon(
  code: string,
  kind: IconKind,
  nodeId: string,
): Promise<string> {
  const defaults: Record<IconKind, string> = {
    ice: 'GLACE',
    spider: 'Spider',
    enemyHacker: 'Hacker',
  };
  const icon: MatrixIcon = {
    kind,
    nodeId,
    iceType: null,
    revealed: true,
    visibleToPlayer: false,
    label: defaults[kind],
    condition: 6,
  };
  const iconRef = push(ref(getDb(), `${sessionPath(code)}/icons`));
  await set(iconRef, icon);
  return iconRef.key as string;
}

export async function updateIcon(
  code: string,
  iconId: string,
  partial: Partial<MatrixIcon>,
): Promise<void> {
  await update(ref(getDb(), `${sessionPath(code)}/icons/${iconId}`), partial);
}

export async function moveIcon(code: string, iconId: string, nodeId: string): Promise<void> {
  await updateIcon(code, iconId, { nodeId });
}

export async function deleteIcon(code: string, iconId: string): Promise<void> {
  await set(ref(getDb(), `${sessionPath(code)}/icons/${iconId}`), null);
}

// ------------------------------------------------------------------ decker

export async function setDeckerNode(code: string, nodeId: string | null): Promise<void> {
  await update(ref(getDb(), `${sessionPath(code)}/decker`), { nodeId });
}

export async function updateDecker(
  code: string,
  partial: Partial<DeckerState>,
): Promise<void> {
  await update(ref(getDb(), `${sessionPath(code)}/decker`), partial);
}

// ------------------------------------------------------------- environnement

export async function setEnvironment(
  code: string,
  partial: Partial<EnvironmentState>,
): Promise<void> {
  await update(ref(getDb(), `${sessionPath(code)}/environment`), partial);
}

// -------------------------------------------------------------- countdowns

export async function setIntervention(code: string, value: number | null): Promise<void> {
  await update(ref(getDb(), `${sessionPath(code)}/countdowns`), { intervention: value });
}

// -------------------------------------------------------------------- jets

/** Publie le dernier jet (miroir MJ, dé de complication inclus). */
export async function publishRoll(code: string, roll: RollRecord): Promise<void> {
  await set(ref(getDb(), `${sessionPath(code)}/lastRoll`), roll);
}

// ----------------------------------------------------------------- attaques

/**
 * Publie la dernière attaque subie par le decker (miroir → notification
 * joueur). L'id (clé push Firebase) garantit qu'un nouvel événement est
 * détecté même si deux attaques successives portent des données identiques.
 */
export async function publishAttack(
  code: string,
  event: Omit<AttackEvent, 'id' | 'ts'>,
): Promise<void> {
  const id = push(ref(getDb(), `${sessionPath(code)}/lastAttack`)).key ?? '';
  await set(ref(getDb(), `${sessionPath(code)}/lastAttack`), {
    ...event,
    id,
    ts: serverTimestamp(),
  });
}

// -------------------------------------------------------------- mini-jeux

export async function publishMiniGame(code: string, game: MiniGameState): Promise<void> {
  await set(ref(getDb(), `${sessionPath(code)}/minigame`), game);
}

export async function updateMiniGame(
  code: string,
  partial: Partial<MiniGameState>,
): Promise<void> {
  await update(ref(getDb(), `${sessionPath(code)}/minigame`), partial);
}

export async function clearMiniGame(code: string): Promise<void> {
  await set(ref(getDb(), `${sessionPath(code)}/minigame`), null);
}

// --------------------------------------------------------------------- log

export async function appendLog(
  code: string,
  kind: LogKind,
  text: string,
  visibility: 'all' | 'gm' = 'all',
): Promise<void> {
  await set(push(ref(getDb(), `${sessionPath(code)}/log`)), {
    ts: serverTimestamp(),
    kind,
    text,
    visibility,
  });
}

// ------------------------------------------------------------- bibliothèque

/** Crée (id = null) ou met à jour un preset. Retourne l'id du preset. */
export async function saveNetworkToLibrary(
  code: string,
  id: string | null,
  name: string,
  data: Omit<NetworkPreset, 'id' | 'name' | 'createdAt'>,
): Promise<string> {
  const db = getDb();
  const presetId =
    id ?? (push(ref(db, `${sessionPath(code)}/library`)).key as string);
  const preset: NetworkPreset = { id: presetId, name, createdAt: Date.now(), ...data };
  await set(ref(db, `${sessionPath(code)}/library/${presetId}`), preset);
  return presetId;
}

export async function deleteNetworkFromLibrary(code: string, id: string): Promise<void> {
  await set(ref(getDb(), `${sessionPath(code)}/library/${id}`), null);
}

export async function renameNetworkInLibrary(
  code: string,
  id: string,
  name: string,
): Promise<void> {
  await update(ref(getDb(), `${sessionPath(code)}/library/${id}`), { name });
}

/**
 * Diffuse une carte au joueur : remplace network + icons, replace le Decker sur
 * le nœud d'entrée de la carte, purge le mini-jeu, et horodate pour l'alerte
 * joueur. Écritures ciblées → les jauges du Decker (stun, physique, Chance…)
 * sont conservées.
 */
export async function loadNetworkPreset(code: string, preset: NetworkPreset): Promise<void> {
  await update(ref(getDb(), sessionPath(code)), {
    network: {
      nodes: preset.network?.nodes ?? null,
      links: preset.network?.links ?? null,
    },
    icons: migrateIcons(preset.icons as unknown as Record<string, unknown>) ?? null,
    'decker/nodeId': preset.deckerNodeId ?? null,
    'decker/networkLoadedAt': Date.now(),
    minigame: null,
  });
}

/** Amorce la bibliothèque avec les modèles fournis (idempotent : ré-clic = écrase). */
export async function seedDefaultLibrary(code: string): Promise<void> {
  const updates: Record<string, NetworkPreset> = {};
  for (const t of NETWORK_TEMPLATES) {
    updates[t.id] = {
      id: t.id,
      name: t.name,
      createdAt: Date.now(),
      network: {
        nodes: t.data.network.nodes ?? null,
        links: t.data.network.links ?? null,
      },
      icons: t.data.icons ?? null,
      deckerNodeId: t.data.decker?.nodeId ?? null,
    };
  }
  await update(ref(getDb(), `${sessionPath(code)}/library`), updates);
}

// ---------------------------------------------------------- export / import

/** Sérialise le réseau courant (nodes, links, icons, position decker). */
export function exportNetwork(): NetworkExport {
  const { nodes, links, icons, decker, library } = useNetworkStore.getState();
  return {
    network: {
      nodes: Object.keys(nodes).length ? nodes : null,
      links: Object.keys(links).length ? links : null,
    },
    icons: Object.keys(icons).length ? icons : null,
    decker: decker.nodeId ? { nodeId: decker.nodeId } : null,
    library: Object.keys(library).length ? library : null,
  };
}

/** Migre les types d'icônes obsolètes (patrouilleuse -> bloqueuse, traceuse -> acide) */
export function migrateIcons(icons: Record<string, unknown> | null): Record<string, MatrixIcon> | null {
  if (!icons) return null;
  const migrated: Record<string, MatrixIcon> = {};
  for (const [id, icon] of Object.entries(icons)) {
    if (icon && typeof icon === 'object') {
      const iconObj = icon as Record<string, unknown>;
      let iceType = iconObj.iceType as string | null | undefined;
      if (iceType === 'patrouilleuse') {
        iceType = 'bloqueuse';
      } else if (iceType === 'traceuse') {
        iceType = 'acide';
      }
      migrated[id] = { ...iconObj, iceType } as unknown as MatrixIcon;
    }
  }
  return migrated;
}

/** Remplace intégralement network + icons (+ position decker) par l'import.
 *  Les jauges du decker (mode, stun, Chance) ne sont pas touchées. */
export async function importNetwork(code: string, data: NetworkExport): Promise<void> {
  await update(ref(getDb(), sessionPath(code)), {
    network: data.network ?? null,
    icons: migrateIcons(data.icons as unknown as Record<string, unknown>) ?? null,
    'decker/nodeId': data.decker?.nodeId ?? null,
    ...(data.library !== undefined ? { library: data.library ?? null } : {}),
  });
}

/** Vide le réseau de la session (nodes, links, icons, position decker). */
export async function clearNetwork(code: string): Promise<void> {
  await update(ref(getDb(), sessionPath(code)), {
    network: null,
    icons: null,
    'decker/nodeId': null,
  });
}
