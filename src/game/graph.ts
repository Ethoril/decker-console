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
