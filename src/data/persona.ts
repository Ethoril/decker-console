// Profil du personnage decker — codé en dur (CDC §3.1).
// Tout le reste du moteur est générique : seul ce fichier est spécifique au PJ.

export const PERSONA = {
  name: 'Decker',
  logique: 6,
  hacking: 5,
  electronique: 4,
  specCybercombat: 2, // spécialisation (cybercombat — Phase 3)
  deck: {
    name: 'Shiawase Cyber-5',
    firewall: 2,
    monitor: 9,
    programSlots: 2,
    rerollPerTest: 1, // 1 relance des échecs par test matriciel
  },
  datajack: 1, // +1D en RV/Hot-Sim, cumulatif avec le bonus de mode (CDC §8.1)
  traits: {
    bonCodeur: 2, // +2D Hacking HORS cybercombat
    cybercombattant: 2, // +2D cybercombat, cumulatif avec la spé (Phase 3)
    ecorche: 2, // 2 cases Étourdissant à chaque connexion RV/Hot-Sim
  },
  programs: [
    { id: 'marteau', level: 2, effect: '+1 dégât en cybercombat' },
    { id: 'discretion', level: 2, effect: '−1D aux tests de pistage adverses' },
  ],
  chance: 2,
} as const;
