// Les 9 types de GLACE et leurs effets (CDC §3.7).
// Stats standard : Firewall 6, Logique 5 → jet d'attaque/défense « 6+5 » = 11D
// (CDC §4.3), dégâts de base 3 Étourdissant (3 Physique pour la Noire).

import type { IceType } from '../types';

export const ICE_STATS = {
  firewall: 6,
  logique: 5,
  /** Jet auto « 6+5 » (CDC §4.3) pour l'attaque comme la défense. */
  attackPool: 11,
  defensePool: 11,
  baseDamage: 3,
  condition: 6,
} as const;

export interface IceEffect {
  /** Description courte de l'effet à l'impact (fiche MJ). */
  onHitText: string | null;
  /** Note passive (pas d'effet à l'impact). */
  passiveText: string | null;
  /** Bonus de dés à l'attaque (Tueuse). */
  attackBonus: number;
  /** Les dégâts vont toujours au physique du decker (Noire). */
  alwaysPhysical: boolean;
}

export const ICE_EFFECTS: Record<IceType, IceEffect> = {
  acide: {
    onHitText: '−1 Firewall du decker (cumulatif, durée scène)',
    passiveText: null,
    attackBonus: 0,
    alwaysPhysical: false,
  },
  bloqueuse: {
    onHitText: 'Debuff : ignorer 1 succès sur les prochains tests',
    passiveText: null,
    attackBonus: 0,
    alwaysPhysical: false,
  },
  brouilleuse: {
    onHitText: 'Reboot forcé en fin de tour (Surveillance → 0, deck inactif 3 tours)',
    passiveText: null,
    attackBonus: 0,
    alwaysPhysical: false,
  },
  crash: {
    onHitText: 'Plante 1 programme au choix du MJ (toggles programmes)',
    passiveText: null,
    attackBonus: 0,
    alwaysPhysical: false,
  },
  noire: {
    onHitText: null,
    passiveText: 'Dégâts PHYSIQUES au decker, quel que soit le mode',
    attackBonus: 0,
    alwaysPhysical: true,
  },
  patrouilleuse: {
    onHitText: null,
    passiveText: 'Relance 2 échecs en perception (à gérer sur ses jets de détection)',
    attackBonus: 0,
    alwaysPhysical: false,
  },
  potDeColle: {
    onHitText: 'Piégé : déconnexion/reboot interdits, fuite = test de Hacking',
    passiveText: null,
    attackBonus: 0,
    alwaysPhysical: false,
  },
  traceuse: {
    onHitText: null,
    passiveText: '+2D aux tests de pistage du système',
    attackBonus: 0,
    alwaysPhysical: false,
  },
  tueuse: {
    onHitText: null,
    passiveText: '+2D en cybercombat (inclus dans son jet d’attaque)',
    attackBonus: 2,
    alwaysPhysical: false,
  },
};
