import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Link, MatrixIcon, NetworkNode } from '../../types';
import { ICE_SHORT, NodeGlyph, nodeColors } from './shapes';

export interface MapSelection {
  kind: 'node' | 'icon';
  id: string;
}

interface NetworkMapProps {
  nodes: Record<string, NetworkNode>;
  links: Record<string, Link>;
  icons: Record<string, MatrixIcon>;
  deckerNodeId: string | null;
  /** Rendu côté decker : silhouettes pour les nœuds `spotted`. */
  fog?: boolean;
  selection: MapSelection | null;
  nodesDraggable?: boolean;
  iconsDraggable?: boolean;
  onNodeTap?: (id: string) => void;
  onIconTap?: (id: string) => void;
  onLinkTap?: (id: string) => void;
  onBackgroundTap?: (x: number, y: number) => void;
  /** Drag de nœud : appelé throttlé pendant le drag, puis avec final=true. */
  onNodeMove?: (id: string, x: number, y: number, final: boolean) => void;
  /** Drag d'icône : appelé au relâchement avec le nœud le plus proche. */
  onIconDrop?: (id: string, nodeId: string) => void;
}

interface View {
  x: number;
  y: number;
  scale: number; // px écran par unité monde
}

type Hit = { kind: 'node' | 'icon' | 'link'; id: string } | null;

interface Gesture {
  mode: 'idle' | 'pan' | 'pinch' | 'dragNode' | 'dragIcon';
  hit: Hit;
  startClient: { x: number; y: number };
  moved: boolean;
  dragId: string | null;
  /** Décalage curseur → centre de l'élément draggé (unités monde). */
  dragOffset: { x: number; y: number };
  pinchDist: number;
}

const TAP_SLOP_PX = 8;
const WRITE_THROTTLE_MS = 100;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

/** Emplacements en éventail des icônes autour d'un nœud (unités monde). */
const ICON_SLOTS = [
  { x: 28, y: -28 },
  { x: 30, y: 24 },
  { x: -30, y: 24 },
  { x: 0, y: -42 },
  { x: 44, y: 0 },
  { x: -44, y: 0 },
];
const PERSONA_OFFSET = { x: -28, y: -28 };

export default function NetworkMap({
  nodes,
  links,
  icons,
  deckerNodeId,
  fog = false,
  selection,
  nodesDraggable = false,
  iconsDraggable = false,
  onNodeTap,
  onIconTap,
  onLinkTap,
  onBackgroundTap,
  onNodeMove,
  onIconDrop,
}: NetworkMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [view, setView] = useState<View>({ x: -400, y: -250, scale: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;

  // Position locale pendant un drag (rendu optimiste).
  const [dragNodePos, setDragNodePos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [dragIconPos, setDragIconPos] = useState<{ id: string; x: number; y: number } | null>(null);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({
    mode: 'idle',
    hit: null,
    startClient: { x: 0, y: 0 },
    moved: false,
    dragId: null,
    dragOffset: { x: 0, y: 0 },
    pinchDist: 0,
  });
  const downHit = useRef<Hit>(null);
  const lastWrite = useRef(0);
  const fitted = useRef(false);

  // ------------------------------------------------------------ dimensions
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      const prev = sizeRef.current;
      if (prev && (prev.w !== w || prev.h !== h)) {
        // Rotation / redimensionnement : on préserve le centre de la vue,
        // sinon le contenu dérive hors champ.
        setView((v) => ({
          ...v,
          x: v.x + (prev.w - w) / (2 * v.scale),
          y: v.y + (prev.h - h) / (2 * v.scale),
        }));
      }
      sizeRef.current = { w, h };
      setSize({ w, h });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Cadrage initial sur le contenu, une seule fois.
  useEffect(() => {
    if (fitted.current) return;
    const list = Object.values(nodes);
    const w = wrapRef.current?.clientWidth ?? 800;
    const h = wrapRef.current?.clientHeight ?? 500;
    if (list.length === 0) {
      setView({ x: -w / 2, y: -h / 2, scale: 1 });
      return;
    }
    fitted.current = true;
    const xs = list.map((n) => n.x);
    const ys = list.map((n) => n.y);
    const pad = 90;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const scale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, Math.min(w / (maxX - minX), h / (maxY - minY), 1.4)),
    );
    setView({
      x: (minX + maxX) / 2 - w / scale / 2,
      y: (minY + maxY) / 2 - h / scale / 2,
      scale,
    });
  }, [nodes]);

  // ------------------------------------------------------------ conversions
  function toWorld(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: v.x + (clientX - rect.left) / v.scale,
      y: v.y + (clientY - rect.top) / v.scale,
    };
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      if (scale === v.scale) return v;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const wx = v.x + px / v.scale;
      const wy = v.y + py / v.scale;
      return { x: wx - px / scale, y: wy - py / scale, scale };
    });
  }

  // Zoom molette (préparation MJ sur desktop) — listener natif non-passif.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // ------------------------------------------------------------ gestes
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // pointerId inactif (entrée synthétique / périphérique exotique) : sans
      // capture, le geste fonctionne quand même tant que le pointeur reste
      // au-dessus du SVG.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (pointers.current.size === 2 && (g.mode === 'pan' || g.mode === 'idle')) {
      // Passage en pinch : le pan en cours devient un zoom à deux doigts.
      const [a, b] = [...pointers.current.values()];
      g.mode = 'pinch';
      g.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      return;
    }
    if (pointers.current.size > 1) return; // doigts surnuméraires ignorés

    const hit = downHit.current;
    downHit.current = null;
    g.hit = hit;
    g.startClient = { x: e.clientX, y: e.clientY };
    g.moved = false;
    g.dragId = null;

    if (hit?.kind === 'node' && nodesDraggable && onNodeMove) {
      const node = nodes[hit.id];
      if (node) {
        const w = toWorld(e.clientX, e.clientY);
        g.mode = 'dragNode';
        g.dragId = hit.id;
        g.dragOffset = { x: node.x - w.x, y: node.y - w.y };
        return;
      }
    }
    if (hit?.kind === 'icon' && iconsDraggable && onIconDrop) {
      const icon = icons[hit.id];
      const node = icon ? nodes[icon.nodeId] : undefined;
      if (icon && node) {
        g.mode = 'dragIcon';
        g.dragId = hit.id;
        g.dragOffset = { x: 0, y: 0 };
        return;
      }
    }
    g.mode = 'pan';
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (
      !g.moved &&
      Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y) > TAP_SLOP_PX
    ) {
      g.moved = true;
    }

    if (g.mode === 'pinch') {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.pinchDist > 0 && dist > 0) {
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / g.pinchDist);
      }
      g.pinchDist = dist;
      return;
    }

    if (g.mode === 'pan') {
      const s = viewRef.current.scale;
      setView((v) => ({
        ...v,
        x: v.x - (e.clientX - prev.x) / s,
        y: v.y - (e.clientY - prev.y) / s,
      }));
      return;
    }

    if (g.mode === 'dragNode' && g.dragId) {
      const w = toWorld(e.clientX, e.clientY);
      const x = w.x + g.dragOffset.x;
      const y = w.y + g.dragOffset.y;
      setDragNodePos({ id: g.dragId, x, y });
      const now = performance.now();
      if (now - lastWrite.current >= WRITE_THROTTLE_MS) {
        lastWrite.current = now;
        onNodeMove?.(g.dragId, Math.round(x), Math.round(y), false);
      }
      return;
    }

    if (g.mode === 'dragIcon' && g.dragId) {
      const w = toWorld(e.clientX, e.clientY);
      setDragIconPos({ id: g.dragId, x: w.x, y: w.y });
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (g.mode === 'pinch') {
      if (pointers.current.size < 2) g.mode = pointers.current.size === 1 ? 'pan' : 'idle';
      return;
    }
    if (pointers.current.size > 0) return;

    if (g.mode === 'dragNode' && g.dragId) {
      if (g.moved && dragNodePos && dragNodePos.id === g.dragId) {
        onNodeMove?.(g.dragId, Math.round(dragNodePos.x), Math.round(dragNodePos.y), true);
      } else if (!g.moved && g.hit) {
        onNodeTap?.(g.hit.id); // tap sans déplacement = sélection
      }
      setDragNodePos(null);
    } else if (g.mode === 'dragIcon' && g.dragId) {
      if (g.moved && dragIconPos && dragIconPos.id === g.dragId) {
        const nearest = nearestNodeId(dragIconPos.x, dragIconPos.y);
        if (nearest) onIconDrop?.(g.dragId, nearest);
      } else if (!g.moved && g.hit) {
        onIconTap?.(g.hit.id);
      }
      setDragIconPos(null);
    } else if (g.mode === 'pan' && !g.moved) {
      // Tap simple : dispatch selon la cible touchée au pointerdown.
      if (g.hit?.kind === 'node') onNodeTap?.(g.hit.id);
      else if (g.hit?.kind === 'icon') onIconTap?.(g.hit.id);
      else if (g.hit?.kind === 'link') onLinkTap?.(g.hit.id);
      else {
        const w = toWorld(e.clientX, e.clientY);
        onBackgroundTap?.(Math.round(w.x), Math.round(w.y));
      }
    }
    g.mode = 'idle';
    g.hit = null;
    g.dragId = null;
  }

  function nearestNodeId(x: number, y: number): string | null {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const [id, n] of Object.entries(nodes)) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    return best;
  }

  // ------------------------------------------------------------ rendu
  const nodePos = (id: string): { x: number; y: number } | null => {
    if (dragNodePos && dragNodePos.id === id) return dragNodePos;
    const n = nodes[id];
    return n ? { x: n.x, y: n.y } : null;
  };

  // Icônes groupées par nœud pour la disposition en éventail.
  const iconsByNode = new Map<string, Array<[string, MatrixIcon]>>();
  for (const entry of Object.entries(icons)) {
    const list = iconsByNode.get(entry[1].nodeId) ?? [];
    list.push(entry);
    iconsByNode.set(entry[1].nodeId, list);
  }
  const iconPos = (iconId: string, icon: MatrixIcon): { x: number; y: number } | null => {
    if (dragIconPos && dragIconPos.id === iconId) return dragIconPos;
    const base = nodePos(icon.nodeId);
    if (!base) return null;
    const siblings = iconsByNode.get(icon.nodeId) ?? [];
    const slot = ICON_SLOTS[siblings.findIndex(([id]) => id === iconId) % ICON_SLOTS.length];
    return { x: base.x + slot.x, y: base.y + slot.y };
  };

  const deckerPos = deckerNodeId ? nodePos(deckerNodeId) : null;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-abyss">
      <svg
        ref={svgRef}
        className="h-full w-full"
        style={{ touchAction: 'none', cursor: 'grab' }}
        viewBox={`${view.x} ${view.y} ${size.w / view.scale} ${size.h / view.scale}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <filter id="neon-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Liens */}
        <g>
          {Object.entries(links).map(([linkId, link]) => {
            const a = nodePos(link.from);
            const b = nodePos(link.to);
            if (!a || !b) return null;
            return (
              <g key={linkId} onPointerDown={() => (downHit.current = { kind: 'link', id: linkId })}>
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="var(--color-neon-cyan-dim)"
                  strokeWidth={1.5}
                  opacity={0.55}
                  vectorEffect="non-scaling-stroke"
                />
                {/* zone tactile élargie */}
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="transparent"
                  strokeWidth={22}
                />
              </g>
            );
          })}
        </g>

        {/* Nœuds */}
        <g>
          {Object.entries(nodes).map(([nodeId, node]) => {
            const pos = nodePos(nodeId)!;
            const silhouette = fog && node.state === 'spotted';
            const colors = nodeColors(node.state);
            const isSelected = selection?.kind === 'node' && selection.id === nodeId;
            return (
              <g
                key={nodeId}
                transform={`translate(${pos.x} ${pos.y})`}
                onPointerDown={() => (downHit.current = { kind: 'node', id: nodeId })}
                className={colors.pulse ? 'pulse-alert' : undefined}
                style={{ cursor: 'pointer' }}
              >
                {/* zone tactile ≥ 40 px */}
                <circle r="30" fill="transparent" />
                {isSelected && (
                  <circle
                    r="28"
                    fill="transparent"
                    stroke="var(--color-neon-amber)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <NodeGlyph
                  type={node.type}
                  stroke={colors.stroke}
                  fill={colors.fill}
                  dashed={colors.dashed}
                  silhouette={silhouette}
                />
                {/* Diodes de Marks */}
                {!silhouette &&
                  Array.from({ length: 4 }, (_, i) => {
                    const a = ((-126 + i * 24) * Math.PI) / 180;
                    return (
                      <circle
                        key={i}
                        cx={Math.cos(a) * 30}
                        cy={Math.sin(a) * 30}
                        r="2.6"
                        fill={i < node.marks ? 'var(--color-neon-green)' : 'var(--color-grid)'}
                      />
                    );
                  })}
                <text
                  y="40"
                  textAnchor="middle"
                  fontSize="11"
                  fill={silhouette ? 'var(--color-ink-dim)' : 'var(--color-ink)'}
                  style={{ fontFamily: 'var(--font-term)' }}
                >
                  {silhouette ? '???' : node.label}
                </text>
                {!fog && (
                  <text
                    y="52"
                    textAnchor="middle"
                    fontSize="8.5"
                    fill="var(--color-ink-dim)"
                    style={{ fontFamily: 'var(--font-term)' }}
                  >
                    S{node.security} · {node.state}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Icônes mobiles */}
        <g>
          {Object.entries(icons).map(([iconId, icon]) => {
            const pos = iconPos(iconId, icon);
            if (!pos) return null;
            const isSelected = selection?.kind === 'icon' && selection.id === iconId;
            return (
              <g
                key={iconId}
                className={icon.kind === 'ice' ? 'ice-threat' : undefined}
                transform={`translate(${pos.x} ${pos.y})`}
                onPointerDown={() => (downHit.current = { kind: 'icon', id: iconId })}
                style={{ cursor: 'pointer' }}
                opacity={!fog && !icon.visibleToPlayer ? 0.45 : 1}
              >
                <circle r="20" fill="transparent" />
                {isSelected && (
                  <circle
                    r="18"
                    fill="transparent"
                    stroke="var(--color-neon-amber)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <IconGlyph icon={icon} fog={fog} />
              </g>
            );
          })}
        </g>

        {/* Persona du decker */}
        {deckerPos && (
          <g
            transform={`translate(${deckerPos.x + PERSONA_OFFSET.x} ${deckerPos.y + PERSONA_OFFSET.y})`}
            filter="url(#neon-glow)"
            pointerEvents="none"
          >
            <circle r="9" fill="color-mix(in srgb, var(--color-neon-cyan) 25%, transparent)" stroke="var(--color-neon-cyan)" strokeWidth={2} className="pulse-slow" vectorEffect="non-scaling-stroke" />
            <circle r="3.5" fill="var(--color-neon-cyan)" className="pulse-slow" />
          </g>
        )}
      </svg>
    </div>
  );
}

function IconGlyph({ icon, fog }: { icon: MatrixIcon; fog: boolean }) {
  const showType = icon.iceType;
  switch (icon.kind) {
    case 'ice':
      return (
        <g>
          <polygon
            points="0,-14 14,0 0,14 -14,0"
            fill="color-mix(in srgb, var(--color-neon-red) 14%, transparent)"
            stroke="var(--color-neon-red)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {showType && (
            <text
              y="3.5"
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-neon-red)"
              style={{ fontFamily: 'var(--font-term)' }}
            >
              {ICE_SHORT[icon.iceType!]}
            </text>
          )}
          {!fog && (
            <title>{icon.label + (icon.iceType ? ` (${icon.iceType})` : '')}</title>
          )}
        </g>
      );
    case 'spider':
      return (
        <g stroke="var(--color-neon-amber)" strokeWidth={1.6} vectorEffect="non-scaling-stroke">
          {[-50, -25, 25, 50].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const x = Math.sin(a) * 13;
            const y = -Math.cos(a) * 10;
            return (
              <g key={deg}>
                <line x1={0} y1={-2} x2={x} y2={y - 2} fill="none" />
                <line x1={0} y1={2} x2={x} y2={-y + 2} fill="none" />
              </g>
            );
          })}
          <circle r="5.5" fill="var(--color-panel)" />
          <circle r="2.2" fill="var(--color-neon-amber)" stroke="none" />
        </g>
      );
    case 'enemyHacker':
      return (
        <g>
          <circle
            r="10"
            fill="color-mix(in srgb, var(--color-neon-magenta) 18%, transparent)"
            stroke="var(--color-neon-magenta)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <text
            y="3.5"
            textAnchor="middle"
            fontSize="10"
            fill="var(--color-neon-magenta)"
            style={{ fontFamily: 'var(--font-term)' }}
          >
            H
          </text>
        </g>
      );
  }
}
