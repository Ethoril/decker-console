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

/**
 * Rendu d'une GLACE sous forme de losange avec son glyphe intérieur thématique.
 * Si non révélée en mode Decker (fog), affiche un point d'interrogation anonyme.
 */
export function IceGlyph({
  iceType,
  revealed,
  fog,
}: {
  iceType: IceType | null | undefined;
  revealed: boolean;
  fog: boolean;
}) {
  const showType = !fog || revealed;
  // Schéma inversé : losange plein dans la couleur dominante (rouge), détails en noir.
  const container = 'var(--color-neon-red)';
  const detail = 'var(--color-abyss)';
  const stroke = detail;
  const fill = container;

  if (!showType || !iceType) {
    // Rendu anonyme (losange rouge plein + point d'interrogation noir)
    return (
      <g>
        <polygon
          points="0,-16 16,0 0,16 -16,0"
          fill={container}
          stroke={container}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <text
          y="3.5"
          textAnchor="middle"
          fontSize="11"
          fontWeight="bold"
          fill={detail}
          style={{ fontFamily: 'var(--font-term)' }}
        >
          ?
        </text>
      </g>
    );
  }

  // Rendu de la GLACE identifiée avec son glyphe thématique
  let glyphContent = null;

  switch (iceType) {
    case 'acide':
      glyphContent = (
        <g stroke={stroke} strokeWidth={1.5} fill="none" strokeLinecap="round">
          {/* Trois gouttes de corrosion vers le bas */}
          <line x1="-5" y1="-3" x2="-5" y2="3" />
          <circle cx="-5" cy="5.5" r="1.1" fill={stroke} stroke="none" />
          <line x1="0" y1="-5" x2="0" y2="5" />
          <circle cx="0" cy="7.5" r="1.1" fill={stroke} stroke="none" />
          <line x1="5" y1="-3" x2="5" y2="3" />
          <circle cx="5" cy="5.5" r="1.1" fill={stroke} stroke="none" />
        </g>
      );
      break;
    case 'bloqueuse':
      glyphContent = (
        <g stroke={stroke} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round">
          {/* Cadenas fermé */}
          <path d="M -4,-1 V -5 A 4 4 0 0 1 4,-5 V -1" />
          <rect x="-6" y="-1" width="12" height="8" rx="1.2" fill={fill} />
          <circle cx="0" cy="3" r="1" fill={stroke} stroke="none" />
        </g>
      );
      break;
    case 'brouilleuse':
      glyphContent = (
        <g stroke={stroke} strokeWidth={1.5} fill="none" strokeLinecap="round">
          {/* Antenne et ondes de brouillage */}
          <circle cx="0" cy="4.5" r="1.5" fill={stroke} stroke="none" />
          <line x1="0" y1="4.5" x2="0" y2="-5.5" />
          <path d="M -4,-2.5 A 5 5 0 0 1 4,-2.5" />
          <path d="M -7,-5.5 A 9 9 0 0 1 7,-5.5" />
        </g>
      );
      break;
    case 'crash':
      glyphContent = (
        <g stroke={stroke} strokeWidth={1.8} fill="none" strokeLinejoin="miter" strokeLinecap="round">
          {/* Éclair */}
          <path d="M 2.5,-7 L -3,0 H 2 L -2.5,7" />
        </g>
      );
      break;
    case 'noire':
      glyphContent = (
        <g>
          {/* Crâne plein noir : la GLACE la plus létale se démarque en solide
              au milieu des autres glyphes en fil de fer. */}
          <path
            d="M 0,-8 C 5,-8 7,-4.5 7,-1 C 7,1.5 6,3 4.5,4 L 4.5,5.5 C 4.5,6.3 3.8,6.5 3,6.5 L -3,6.5 C -3.8,6.5 -4.5,6.3 -4.5,5.5 L -4.5,4 C -6,3 -7,1.5 -7,-1 C -7,-4.5 -5,-8 0,-8 Z"
            fill={detail}
            stroke="none"
          />
          {/* Orbites creuses (laissent transparaître le fond rouge) */}
          <circle cx="-3" cy="-1.5" r="2" fill={container} stroke="none" />
          <circle cx="3" cy="-1.5" r="2" fill={container} stroke="none" />
          {/* Cavité nasale */}
          <path d="M 0,0.8 L -1.2,3 L 1.2,3 Z" fill={container} stroke="none" />
          {/* Dents (fentes claires dans la mâchoire) */}
          <g stroke={container} strokeWidth={0.9}>
            <line x1="-1.5" y1="4.2" x2="-1.5" y2="6.5" />
            <line x1="0" y1="4.2" x2="0" y2="6.5" />
            <line x1="1.5" y1="4.2" x2="1.5" y2="6.5" />
          </g>
        </g>
      );
      break;
    case 'potDeColle':
      glyphContent = (
        <g stroke={stroke} strokeWidth={1.2} fill="none">
          {/* Toile d'araignée/colle */}
          <line x1="-7" y1="-7" x2="7" y2="7" />
          <line x1="-7" y1="7" x2="7" y2="-7" />
          <line x1="-9" y1="0" x2="9" y2="0" />
          <line x1="0" y1="-9" x2="0" y2="9" />
          <circle cx="0" cy="0" r="3.5" />
          <circle cx="0" cy="0" r="7" />
        </g>
      );
      break;
    case 'tueuse':
      glyphContent = (
        <g stroke={stroke} strokeWidth={1.5} fill="none">
          {/* Réticule de visée / Tueuse */}
          <circle cx="0" cy="0" r="6.2" />
          <line x1="-9.5" y1="0" x2="-4.2" y2="0" />
          <line x1="4.2" y1="0" x2="9.5" y2="0" />
          <line x1="0" y1="-9.5" x2="0" y2="-4.2" />
          <line x1="0" y1="4.2" x2="0" y2="9.5" />
          <circle cx="0" cy="0" r="1.5" fill={stroke} stroke="none" />
        </g>
      );
      break;
  }

  return (
    <g>
      {/* Conteneur principal (losange rouge plein) */}
      <polygon
        points="0,-16 16,0 0,16 -16,0"
        fill={container}
        stroke={container}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {glyphContent}
    </g>
  );
}

/**
 * Rendu du Spider de sécurité : schéma inversé, disque ambre plein (couleur
 * dominante) et silhouette d'araignée mécanique en noir, avec fente laser rouge.
 */
export function SpiderGlyph() {
  const dominant = 'var(--color-neon-amber)';
  const detail = 'var(--color-abyss)';

  return (
    <g vectorEffect="non-scaling-stroke">
      {/* Fond circulaire ambre (couleur dominante) */}
      <circle cx="0" cy="2.5" r="17.5" fill={dominant} stroke="none" />

      {/* Pattes articulées noires (polylignes) */}
      <g stroke={detail} strokeWidth={1.6} fill="none">
        {/* Gauche */}
        <polyline points="-3,-3 -9,-9 -13,-4" />
        <polyline points="-4,-1 -11,-3 -15,2" />
        <polyline points="-4,1 -11,3 -15,8" />
        <polyline points="-3,3 -9,9 -12,14" />
        {/* Droite */}
        <polyline points="3,-3 9,-9 13,-4" />
        <polyline points="4,-1 11,-3 15,2" />
        <polyline points="4,1 11,3 15,8" />
        <polyline points="3,3 9,9 12,14" />
      </g>

      {/* Corps robotique noir */}
      {/* Thorax */}
      <rect x="-3.5" y="-3.5" width="7" height="7" rx="1.5" fill={detail} stroke="none" />
      {/* Abdomen */}
      <polygon points="-3.5,3.5 3.5,3.5 2,9.5 -2,9.5" fill={detail} stroke="none" />
      {/* Tête */}
      <circle cx="0" cy="-5" r="2.2" fill={detail} stroke="none" />
      {/* Fente laser scan rouge */}
      <line x1="-1.5" y1="-5" x2="1.5" y2="-5" stroke="var(--color-neon-red)" strokeWidth={0.9} />
    </g>
  );
}

/**
 * Rendu du Hacker ennemi sous forme d'hexagone cybernétique magenta avec un masque à visière.
 */
export function HackerGlyph() {
  const stroke = 'var(--color-neon-magenta)';
  const fill = 'color-mix(in srgb, var(--color-neon-magenta) 18%, transparent)';

  return (
    <g>
      {/* Conteneur Hexagonal */}
      <polygon
        points="0,-14 12,-7 12,7 0,14 -12,7 -12,-7"
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {/* Masque facial */}
      <path
        d="M -6,-3 L -4,-6 H 4 L 6,-3 L 4,4 H -4 Z"
        fill="var(--color-panel)"
        stroke={stroke}
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Visière lumineuse double ligne */}
      <line x1="-3.5" y1="-1" x2="3.5" y2="-1" stroke={stroke} strokeWidth={1.5} />
      <line x1="-2" y1="1.5" x2="2" y2="1.5" stroke={stroke} strokeWidth={1} />
    </g>
  );
}
