// Composition des réserves de dés ligne par ligne (CDC §3.2).
// Chaque ligne est affichée et désactivable dans l'écran de jet : le joueur ou
// le MJ peut décocher une ligne contestée.

import { PERSONA } from '../data/persona';
import { SECURITY_TABLE } from '../data/security';
import type {
  EnvironmentState,
  NetworkNode,
  PoolLine,
} from '../types';

function line(id: string, label: string, value: number): PoolLine {
  return { id, label, value, enabled: true };
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
  env: EnvironmentState,
): PoolLine[] {
  const lines: PoolLine[] = [
    line('hacking', 'Hacking', PERSONA.hacking),
    line('logique', 'Logique', PERSONA.logique),
    line('bonCodeur', 'Bon codeur (hors cybercombat)', PERSONA.traits.bonCodeur),
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

/** Perception matricielle (scan des environs). */
export function perceptionPool(): PoolLine[] {
  return [
    line('logique', 'Logique', PERSONA.logique),
    line('electronique', 'Électronique', PERSONA.electronique),
  ];
}

/** Cybercombat — attaque (CDC §3.2). */
export function cybercombatPool(): PoolLine[] {
  return [
    line('hacking', 'Hacking', PERSONA.hacking),
    line('spec', 'Spécialisation cybercombat', PERSONA.specCybercombat),
    line('logique', 'Logique', PERSONA.logique),
    line('cybercombattant', 'Cybercombattant', PERSONA.traits.cybercombattant),
  ];
}

/** Cybercombat — défense (jet automatique) : Logique + Firewall − Acide. */
export function defensePoolSize(firewallPenalty: number): number {
  return PERSONA.logique + Math.max(0, PERSONA.deck.firewall - firewallPenalty);
}

/** Réparation du deck : Électronique + Logique, 1 case/succès (CDC §3.5). */
export function repairPool(): PoolLine[] {
  return [
    line('electronique', 'Électronique', PERSONA.electronique),
    line('logique', 'Logique', PERSONA.logique),
  ];
}

/** Fuite du Pot de colle : test de Hacking (CDC §3.7). */
export function escapePool(): PoolLine[] {
  return [
    line('hacking', 'Hacking', PERSONA.hacking),
    line('logique', 'Logique', PERSONA.logique),
    line('bonCodeur', 'Bon codeur (hors cybercombat)', PERSONA.traits.bonCodeur),
  ];
}

export function poolTotal(lines: PoolLine[]): number {
  return Math.max(
    0,
    lines.filter((l) => l.enabled).reduce((sum, l) => sum + l.value, 0),
  );
}
