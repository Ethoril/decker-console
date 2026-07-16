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
  const common = {
    stroke,
    fill: silhouette ? 'transparent' : fill,
    strokeWidth: 2,
    strokeDasharray: dashed || silhouette ? '5 4' : undefined,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  switch (type) {
    case 'entry':
      return <polygon points="0,-22 21,15 -21,15" {...common} />;
    case 'firewall': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        return `${(Math.cos(a) * 21).toFixed(1)},${(Math.sin(a) * 21).toFixed(1)}`;
      }).join(' ');
      return <polygon points={pts} {...common} />;
    }
    case 'database':
      return (
        <g>
          <path d="M -14 -13 v 26 a 14 6 0 0 0 28 0 v -26" {...common} />
          <ellipse cx="0" cy="-13" rx="14" ry="6" {...common} />
        </g>
      );
    case 'device':
      return <rect x="-16" y="-16" width="32" height="32" rx="3" {...common} />;
    case 'archive':
      return <polygon points="0,-21 21,0 0,21 -21,0" {...common} />;
    case 'core':
      return (
        <g>
          <circle r="20" {...common} />
          <circle r="11" {...common} fill="transparent" />
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
  patrouilleuse: 'PA',
  potDeColle: 'PC',
  traceuse: 'TR',
  tueuse: 'TU',
};

export const ICE_LABELS: Record<IceType, string> = {
  acide: 'Acide',
  bloqueuse: 'Bloqueuse',
  brouilleuse: 'Brouilleuse',
  crash: 'Crash',
  noire: 'Noire',
  patrouilleuse: 'Patrouilleuse',
  potDeColle: 'Pot de colle',
  traceuse: 'Traceuse',
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
