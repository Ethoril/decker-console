import type { NetworkExport } from '../types';

export interface NetworkTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: 'Initiation' | 'Standard' | 'Hostile';
  data: NetworkExport;
}

export const NETWORK_TEMPLATES: NetworkTemplate[] = [
  {
    id: 'street-relay',
    name: 'Relais de quartier',
    description: 'Petit réseau d’introduction : caméra, verrou et une GLACE de patrouille.',
    difficulty: 'Initiation',
    data: {
      network: {
        nodes: {
          entry: { label: 'Point d’accès', type: 'entry', x: 90, y: 260, security: 2, state: 'infiltrated', marks: 1 },
          router: { label: 'Routeur public', type: 'firewall', x: 260, y: 260, security: 3, state: 'spotted', marks: 0 },
          cameras: { label: 'Caméras', type: 'device', x: 430, y: 150, security: 3, state: 'hidden', marks: 0, deviceInfo: 'Boucle vidéo et orientation des caméras.' },
          lock: { label: 'Maglock', type: 'device', x: 430, y: 370, security: 4, state: 'hidden', marks: 0, deviceInfo: 'Verrou de la porte de service.' },
          archive: { label: 'Journal local', type: 'archive', x: 610, y: 260, security: 4, state: 'hidden', marks: 0, paydata: 'Historique des passages des sept derniers jours.' },
        },
        links: {
          l1: { from: 'entry', to: 'router' },
          l2: { from: 'router', to: 'cameras' },
          l3: { from: 'router', to: 'lock' },
          l4: { from: 'cameras', to: 'archive' },
          l5: { from: 'lock', to: 'archive' },
        },
      },
      icons: {
        patrol: { kind: 'ice', nodeId: 'router', iceType: 'bloqueuse', revealed: true, visibleToPlayer: true, label: 'Sentinelle locale', condition: 6 },
      },
      decker: { nodeId: 'entry' },
    },
  },
  {
    id: 'corporate-office',
    name: 'Annexe corporatiste',
    description: 'Réseau ramifié avec données RH, laboratoire et Spider de sécurité.',
    difficulty: 'Standard',
    data: {
      network: {
        nodes: {
          entry: { label: 'Accueil invité', type: 'entry', x: 70, y: 270, security: 3, state: 'infiltrated', marks: 1 },
          gate: { label: 'Pare-feu Shiawase', type: 'firewall', x: 230, y: 270, security: 5, state: 'spotted', marks: 0 },
          office: { label: 'Postes bureau', type: 'device', x: 390, y: 100, security: 4, state: 'hidden', marks: 0, deviceInfo: 'Sessions et terminaux des employés.' },
          cams: { label: 'Sécurité bâtiment', type: 'device', x: 390, y: 250, security: 5, state: 'hidden', marks: 0, deviceInfo: 'Caméras, ascenseurs et contrôle d’accès.' },
          lab: { label: 'Laboratoire', type: 'database', x: 390, y: 410, security: 6, state: 'hidden', marks: 0, paydata: 'Protocoles d’essai du projet Kintsugi.' },
          hr: { label: 'Archives RH', type: 'archive', x: 570, y: 100, security: 4, state: 'hidden', marks: 0, paydata: 'Dossiers du personnel et emplois du temps.' },
          security: { label: 'Nœud sécurité', type: 'firewall', x: 570, y: 330, security: 7, state: 'hidden', marks: 0 },
          core: { label: 'Cœur de l’annexe', type: 'core', x: 750, y: 250, security: 7, state: 'hidden', marks: 0 },
        },
        links: {
          l1: { from: 'entry', to: 'gate' }, l2: { from: 'gate', to: 'office' },
          l3: { from: 'gate', to: 'cams' }, l4: { from: 'gate', to: 'lab' },
          l5: { from: 'office', to: 'hr' }, l6: { from: 'cams', to: 'security' },
          l7: { from: 'lab', to: 'security' }, l8: { from: 'hr', to: 'core' },
          l9: { from: 'security', to: 'core' },
        },
      },
      icons: {
        patrol: { kind: 'ice', nodeId: 'gate', iceType: 'bloqueuse', revealed: true, visibleToPlayer: true, label: 'Watchdog', condition: 6 },
        blocker: { kind: 'ice', nodeId: 'security', iceType: 'bloqueuse', revealed: true, visibleToPlayer: false, label: 'Lockjaw', condition: 6 },
        spider: { kind: 'spider', nodeId: 'core', iceType: null, revealed: true, visibleToPlayer: false, label: 'Spider de garde', condition: 8 },
      },
      decker: { nodeId: 'entry' },
    },
  },
  {
    id: 'black-vault',
    name: 'Chambre noire',
    description: 'Host sécurisé, routes redondantes et contre-mesures létales autour du coffre.',
    difficulty: 'Hostile',
    data: {
      network: {
        nodes: {
          entry: { label: 'Faux relais', type: 'entry', x: 70, y: 280, security: 5, state: 'infiltrated', marks: 1 },
          outer: { label: 'Bastion externe', type: 'firewall', x: 220, y: 280, security: 7, state: 'spotted', marks: 0 },
          honey: { label: 'Leurre financier', type: 'database', x: 380, y: 80, security: 6, state: 'hidden', marks: 0, paydata: 'Faux transferts destinés à identifier les intrus.' },
          trace: { label: 'Relais de traçage', type: 'device', x: 380, y: 210, security: 8, state: 'hidden', marks: 0 },
          inner: { label: 'Bastion interne', type: 'firewall', x: 380, y: 390, security: 8, state: 'hidden', marks: 0 },
          ops: { label: 'Console Spider', type: 'device', x: 550, y: 100, security: 7, state: 'hidden', marks: 0, deviceInfo: 'Commandes de déploiement des GLACES.' },
          black: { label: 'Zone noire', type: 'archive', x: 550, y: 280, security: 9, state: 'hidden', marks: 0 },
          power: { label: 'Contrôle énergie', type: 'device', x: 550, y: 440, security: 7, state: 'hidden', marks: 0, deviceInfo: 'Alimentation et refroidissement du coffre.' },
          vault: { label: 'Coffre Oméga', type: 'database', x: 730, y: 280, security: 10, state: 'hidden', marks: 0, paydata: 'Dossier Oméga — identité des actifs dormants.' },
          core: { label: 'Cœur noir', type: 'core', x: 900, y: 280, security: 10, state: 'hidden', marks: 0 },
        },
        links: {
          l1: { from: 'entry', to: 'outer' }, l2: { from: 'outer', to: 'honey' },
          l3: { from: 'outer', to: 'trace' }, l4: { from: 'outer', to: 'inner' },
          l5: { from: 'honey', to: 'ops' }, l6: { from: 'trace', to: 'black' },
          l7: { from: 'inner', to: 'black' }, l8: { from: 'inner', to: 'power' },
          l9: { from: 'ops', to: 'vault' }, l10: { from: 'black', to: 'vault' },
          l11: { from: 'power', to: 'vault' }, l12: { from: 'vault', to: 'core' },
        },
      },
      icons: {
        trace: { kind: 'ice', nodeId: 'trace', iceType: 'acide', revealed: true, visibleToPlayer: false, label: 'Limier', condition: 6 },
        tar: { kind: 'ice', nodeId: 'inner', iceType: 'potDeColle', revealed: true, visibleToPlayer: false, label: 'Goudron', condition: 6 },
        black: { kind: 'ice', nodeId: 'black', iceType: 'noire', revealed: true, visibleToPlayer: false, label: 'Ange noir', condition: 8 },
        killer: { kind: 'ice', nodeId: 'vault', iceType: 'tueuse', revealed: true, visibleToPlayer: false, label: 'Cerbère', condition: 8 },
        spider: { kind: 'spider', nodeId: 'ops', iceType: null, revealed: true, visibleToPlayer: false, label: 'Spider Oméga', condition: 10, atkPool: 13, defPool: 11 },
      },
      decker: { nodeId: 'entry' },
    },
  },
];
