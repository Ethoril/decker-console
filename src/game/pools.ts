// Composition des réserves de dés ligne par ligne (CDC §3.2).
// Chaque ligne est affichée et désactivable dans l'écran de jet : le joueur ou
// le MJ peut décocher une ligne contestée.

import { PERSONA } from '../data/persona';
import { SECURITY_TABLE } from '../data/security';
import type {
  ConnectionMode,
  EnvironmentState,
  NetworkNode,
  PoolLine,
} from '../types';

function line(id: string, label: string, value: number): PoolLine {
  return { id, label, value, enabled: true };
}

function modeLines(mode: ConnectionMode): PoolLine[] {
  const lines: PoolLine[] = [];
  if (mode === 'VR') lines.push(line('mode', 'Mode RV', 1));
  if (mode === 'HOTSIM') lines.push(line('mode', 'Mode Hot-Sim', 1));
  if (mode !== 'AR') {
    // Cumulatif avec le bonus de mode (décision MJ, CDC §8.1)
    lines.push(line('datajack', 'Datajack (RV/HS)', PERSONA.datajack));
  }
  return lines;
}

function environmentLines(env: EnvironmentState): PoolLine[] {
  const lines: PoolLine[] = [];
  const noise = env.noise ?? 0;
  const dist = env.wifiDistance ?? 0;
  if (noise > 0) lines.push(line('noise', 'Bruit', -noise));
  if (dist > 0) lines.push(line('distance', 'Distance wifi', -dist));
  return lines;
}

/** Test d'infiltration (hack de nœud) — Force Brute ou Corruption. */
export function infiltrationPool(
  targetNode: NetworkNode,
  mode: ConnectionMode,
  env: EnvironmentState,
): PoolLine[] {
  const lines: PoolLine[] = [
    line('hacking', 'Hacking', PERSONA.hacking),
    line('logique', 'Logique', PERSONA.logique),
    line('bonCodeur', 'Bon codeur (hors cybercombat)', PERSONA.traits.bonCodeur),
    ...modeLines(mode),
    ...environmentLines(env),
  ];
  const secMod = SECURITY_TABLE[targetNode.security]?.modifier ?? 0;
  if (secMod !== 0) {
    // Modificateur de difficulté du nœud, soustrait de la réserve. Label sans
    // le niveau : le decker ne connaît pas la sécurité d'un nœud non infiltré.
    lines.push(line('security', 'Sécurité du nœud', -secMod));
  }
  return lines;
}

/** Perception matricielle (scan des environs, analyse d'une GLACE). */
export function perceptionPool(mode: ConnectionMode): PoolLine[] {
  return [
    line('logique', 'Logique', PERSONA.logique),
    line('electronique', 'Électronique', PERSONA.electronique),
    ...modeLines(mode),
  ];
}

export function poolTotal(lines: PoolLine[]): number {
  return Math.max(
    0,
    lines.filter((l) => l.enabled).reduce((sum, l) => sum + l.value, 0),
  );
}
