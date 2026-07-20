import type { Link } from '../types';

/** Ids des nœuds directement reliés à nodeId. */
export function adjacentNodeIds(
  nodeId: string,
  links: Record<string, Link>,
): Set<string> {
  const adjacent = new Set<string>();
  for (const link of Object.values(links)) {
    if (link.from === nodeId) adjacent.add(link.to);
    if (link.to === nodeId) adjacent.add(link.from);
  }
  return adjacent;
}

/**
 * Calcule l'ID du prochain nœud sur le plus court chemin pour aller de `start` à `target`.
 * Retourne null si aucun chemin n'existe ou si start === target.
 */
export function getNextStepTowards(
  start: string,
  target: string,
  links: Record<string, Link>,
): string | null {
  if (start === target) return null;

  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const parentOf: Record<string, string> = {};

  let found = false;
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === target) {
      found = true;
      break;
    }

    for (const neighbor of adjacentNodeIds(current, links)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parentOf[neighbor] = current;
        queue.push(neighbor);
      }
    }
  }

  if (!found) return null;

  let curr = target;
  const path: string[] = [];
  while (curr !== start) {
    path.push(curr);
    curr = parentOf[curr];
  }
  return path[path.length - 1] || null;
}
