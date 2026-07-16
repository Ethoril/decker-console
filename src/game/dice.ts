// Résolution des jets (CDC §3.3) : d6, succès sur 5-6 (4-6 si Chance dépensée).

export function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollDice(count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, rollD6);
}

export function countSuccesses(dice: number[], successOn: 4 | 5): number {
  return dice.filter((d) => d >= successOn).length;
}

/** Relance Cyber-5 : relance uniquement les dés non-succès (1×/test). */
export function rerollFailures(dice: number[], successOn: 4 | 5): number[] {
  return dice.map((d) => (d >= successOn ? d : rollD6()));
}
