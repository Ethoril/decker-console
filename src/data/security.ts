// Table des niveaux de sécurité (CDC §3.6).
// `modifier` est le modificateur de difficulté du nœud : il est SOUSTRAIT de la
// réserve du decker (niv 1 → +2D pour le decker, niv 10 → −7D).
// Les contre-mesures sont déclenchées par le MJ (automatisation en Phase 3).

export interface SecurityLevel {
  modifier: number;
  countermeasure: string;
}

export const SECURITY_TABLE: Record<number, SecurityLevel> = {
  1: { modifier: -2, countermeasure: 'Aucune' },
  2: { modifier: -1, countermeasure: 'Aucune' },
  3: { modifier: 0, countermeasure: 'Alarme silencieuse : +2 au prochain jet du système' },
  4: { modifier: 1, countermeasure: 'Pic de données : 5D vs Firewall' },
  5: { modifier: 2, countermeasure: 'Pic lourd : 8D vs Firewall' },
  6: { modifier: 3, countermeasure: 'Alarme audible + pic 10D vs FW + +2 au prochain jet système' },
  7: { modifier: 4, countermeasure: 'Spawn 1 GLACE (attaque au tour suivant)' },
  8: { modifier: 5, countermeasure: 'Spawn 3 GLACES' },
  9: { modifier: 6, countermeasure: 'Spawn 1 Spider' },
  10: { modifier: 7, countermeasure: 'Alarme + 3 GLACES + 1 Spider + compte à rebours 10 tours' },
};

/** Marks obtenues selon les succès du jet de hack (CDC §3.4.3). */
export function marksFromSuccesses(successes: number): number {
  if (successes >= 5) return 4;
  if (successes === 4) return 3;
  if (successes === 3) return 2;
  if (successes === 2) return 1;
  return 0;
}

/** Droits conférés par niveau de Mark (CDC §3.4.5). */
export const MARK_RIGHTS: Record<number, string> = {
  1: 'GUEST — tracer',
  2: 'USER — lire les infos / paydata',
  3: 'POWER_USER — modifier fichiers & fonctions',
  4: 'ADMIN — contrôle total',
};
