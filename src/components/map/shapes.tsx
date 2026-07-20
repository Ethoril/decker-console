import type { IceType, NodeState, NodeType } from '../../types';

/** Couleurs de contour/remplissage selon l'état du nœud. */
export function nodeColors(state: NodeState): {
  stroke: string;
  fill: string;
  dashed: boolean;
  pulse: boolean;
} {
  switch (state) {
    case 'hidden': // visible du MJ uniquement
      return { stroke: 'var(--color-ink-dim)', fill: 'transparent', dashed: true, pulse: false };
    case 'spotted':
      return { stroke: 'var(--color-neon-cyan-dim)', fill: 'transparent', dashed: false, pulse: false };
    case 'infiltrated':
      return {
        stroke: 'var(--color-neon-cyan)',
        fill: 'color-mix(in srgb, var(--color-neon-cyan) 10%, transparent)',
        dashed: false,
        pulse: false,
      };
    case 'alerted':
      return {
        stroke: 'var(--color-neon-red)',
        fill: 'color-mix(in srgb, var(--color-neon-red) 12%, transparent)',
        dashed: false,
        pulse: true,
      };
  }
}

/** Forme différenciée par type de nœud, centrée sur (0,0), rayon ~20. */
export function NodeGlyph({
  type,
  stroke,
  fill,
  dashed,
  silhouette,
}: {
  type: NodeType;
  stroke: string;
  fill: string;
  dashed: boolean;
  /** Rendu « spotted » côté decker : pointillés forcés, pas de fill. */
  silhouette?: boolean;
}) {
  const detailsCommon = {
    stroke,
    strokeWidth: 2,
    strokeDasharray: dashed || silhouette ? '5 4' : undefined,
    vectorEffect: 'non-scaling-stroke' as const,
    fill: 'none',
  };

  switch (type) {
    case 'entry':
      return (
        <g>
          {/* Fond du portail */}
          <circle r="20" fill={silhouette ? 'transparent' : fill} stroke="none" />
          {/* Détails du portail */}
          <g {...detailsCommon}>
            {/* Arcs circulaires externes */}
            <path d="M -16,-10 A 20 20 0 0 1 16,-10" />
            <path d="M -16,10 A 20 20 0 0 0 16,10" />
            {/* Chevron central pointant vers l'intérieur */}
            <path d="M -9,-3 L 0,6 L 9,-3" strokeWidth={2.5} />
            {/* Point indicateur */}
            <circle cx="0" cy="-5" r="2.5" fill={silhouette ? 'transparent' : stroke} stroke="none" />
          </g>
        </g>
      );
    case 'firewall':
      return (
        <g>
          {/* Fond du bouclier */}
          <path d="M -18,-16 L 18,-16 L 18,-2 L 0,20 L -18,-2 Z" fill={silhouette ? 'transparent' : fill} stroke="none" />
          {/* Détails du bouclier pare-feu */}
          <g {...detailsCommon}>
            <path d="M -18,-16 L 18,-16 L 18,-2 L 0,20 L -18,-2 Z" />
            {/* Lignes de briques horizontales */}
            <path d="M -12,-8 L 12,-8" strokeWidth={1.5} />
            <path d="M -15,-1 L 15,-1" strokeWidth={1.5} />
            <path d="M -11,6 L 11,6" strokeWidth={1.5} />
            {/* Axe vertical en pointillés */}
            <line x1="0" y1="-16" x2="0" y2="10" strokeWidth={1.2} strokeDasharray="3 3" />
          </g>
        </g>
      );
    case 'database':
      return (
        <g>
          {/* Fond cylindrique global */}
          <path d="M -16,-12 A 16 5 0 0 1 16,-12 V 6 A 16 5 0 0 1 -16,6 Z" fill={silhouette ? 'transparent' : fill} stroke="none" />
          {/* Détails du serveur de base de données */}
          <g {...detailsCommon}>
            {/* Disque supérieur */}
            <ellipse cx="0" cy="-12" rx="16" ry="5" />
            {/* Disque intermédiaire */}
            <path d="M -16,-12 v 9 a 16 5 0 0 0 32 0 v -9" />
            {/* Disque inférieur */}
            <path d="M -16,-3 v 9 a 16 5 0 0 0 32 0 v -9" />
            {/* Indicateurs LED verticaux */}
            <line x1="-7" y1="-8" x2="-7" y2="7" strokeWidth={1.5} strokeDasharray="2 2" />
            <line x1="7" y1="-8" x2="7" y2="7" strokeWidth={1.5} strokeDasharray="2 2" />
          </g>
        </g>
      );
    case 'device':
      return (
        <g>
          {/* Fond carré */}
          <rect x="-16" y="-16" width="32" height="32" rx="4" fill={silhouette ? 'transparent' : fill} stroke="none" />
          {/* Détails du périphérique hardware */}
          <g {...detailsCommon}>
            <rect x="-16" y="-16" width="32" height="32" rx="4" />
            {/* Cadre d'écran intérieur */}
            <rect x="-10" y="-10" width="20" height="20" rx="2" strokeWidth={1.2} />
            {/* Broches/Pins sur les 4 côtés */}
            <line x1="-20" y1="-7" x2="-16" y2="-7" />
            <line x1="-20" y1="7" x2="-16" y2="7" />
            <line x1="16" y1="-7" x2="20" y2="-7" />
            <line x1="16" y1="7" x2="20" y2="7" />
            <line x1="-7" y1="-20" x2="-7" y2="-16" />
            <line x1="7" y1="-20" x2="7" y2="-16" />
            <line x1="-7" y1="16" x2="-7" y2="20" />
            <line x1="7" y1="16" x2="7" y2="20" />
            {/* Témoin d'activité central */}
            <circle cx="0" cy="0" r="2.2" fill={silhouette ? 'transparent' : stroke} stroke="none" />
          </g>
        </g>
      );
    case 'archive':
      return (
        <g>
          {/* Fond du dossier suspendu */}
          <path d="M -18,14 V -8 H -12 L -8,-13 H 14 A 3,3 0 0 1 17,-10 V 14 Z" fill={silhouette ? 'transparent' : fill} stroke="none" />
          {/* Détails de l'archive sécurisée */}
          <g {...detailsCommon}>
            <path d="M -18,14 V -8 H -12 L -8,-13 H 14 A 3,3 0 0 1 17,-10 V 14 Z" />
            {/* Fiches de données intérieures */}
            <line x1="-12" y1="-2" x2="12" y2="-2" strokeWidth={1.5} />
            <line x1="-12" y1="4" x2="8" y2="4" strokeWidth={1.5} />
            <line x1="-12" y1="10" x2="2" y2="10" strokeWidth={1.5} />
          </g>
        </g>
      );
    case 'core':
      return (
        <g>
          {/* Fond du cœur de système */}
          <circle r="20" fill={silhouette ? 'transparent' : fill} stroke="none" />
          {/* Détails du noyau Central Core */}
          <g {...detailsCommon}>
            <circle r="20" />
            {/* Noyau d'énergie central */}
            <circle r="7" />
            <circle r="3.2" fill={silhouette ? 'transparent' : stroke} stroke="none" />
            {/* Bus de données orthogonaux */}
            <line x1="0" y1="-20" x2="0" y2="-12" strokeWidth={1.5} />
            <line x1="0" y1="12" x2="0" y2="20" strokeWidth={1.5} />
            <line x1="-20" y1="0" x2="-12" y2="0" strokeWidth={1.5} />
            <line x1="12" y1="0" x2="20" y2="0" strokeWidth={1.5} />
            {/* Lignes de distribution diagonales */}
            <line x1="-14" y1="-14" x2="-8" y2="-8" strokeWidth={1} />
            <line x1="14" y1="-14" x2="8" y2="-8" strokeWidth={1} />
            <line x1="-14" y1="14" x2="-8" y2="8" strokeWidth={1} />
            <line x1="14" y1="14" x2="8" y2="8" strokeWidth={1} />
          </g>
        </g>
      );
  }
}

/** Abréviation affichée dans le losange d'une GLACE identifiée. */
export const ICE_SHORT: Record<IceType, string> = {
  acide: 'AC',
  bloqueuse: 'BL',
  brouilleuse: 'BR',
  crash: 'CR',
  noire: 'NR',
  potDeColle: 'PC',
  tueuse: 'TU',
};

export const ICE_LABELS: Record<IceType, string> = {
  acide: 'Acide',
  bloqueuse: 'Bloqueuse',
  brouilleuse: 'Brouilleuse',
  crash: 'Crash',
  noire: 'Noire',
  potDeColle: 'Pot de colle',
  tueuse: 'Tueuse',
};

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  entry: 'Entrée',
  firewall: 'Pare-feu',
  database: 'Base de données',
  device: 'Périphérique',
  archive: 'Archive',
  core: 'Cœur',
};
