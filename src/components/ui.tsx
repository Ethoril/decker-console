import { useEffect, useState, type ReactNode } from 'react';

/** Pastille de présence de l'autre rôle. */
export function PresenceDot({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-dim">
      <span
        className={
          'inline-block h-2.5 w-2.5 rounded-full ' +
          (connected
            ? 'bg-neon-green shadow-[0_0_6px_var(--color-neon-green)]'
            : 'bg-grid')
        }
      />
      {label}
    </span>
  );
}

/** true quand la hauteur d'écran est « smartphone paysage » (< 500 px). */
export function useIsShort(): boolean {
  const [short, setShort] = useState(
    () => window.matchMedia('(max-height: 499px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-height: 499px)');
    const onChange = (e: MediaQueryListEvent) => setShort(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return short;
}

/**
 * Colonne latérale : statique en tablette, repliée en tiroir (overlay)
 * quand la hauteur est < 500 px (smartphone paysage).
 */
export function SideColumn({
  side,
  title,
  short,
  children,
  width = 'w-60',
}: {
  side: 'left' | 'right';
  title: string;
  short: boolean;
  children: ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!short) {
    return (
      <aside
        className={`${width} shrink-0 overflow-y-auto border-grid bg-panel p-3 ${
          side === 'left' ? 'border-r' : 'border-l'
        }`}
      >
        {children}
      </aside>
    );
  }

  return (
    <>
      <button
        className={`btn btn-cyan fixed top-1/2 z-30 -translate-y-1/2 px-1.5 py-3 text-xs ${
          side === 'left' ? 'left-0 rounded-l-none' : 'right-0 rounded-r-none'
        }`}
        onClick={() => setOpen(true)}
        aria-label={`Ouvrir ${title}`}
      >
        {side === 'left' ? '»' : '«'}
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-abyss/70" />
          <aside
            className={`relative z-10 h-full w-64 overflow-y-auto border-grid bg-panel p-3 ${
              side === 'left' ? 'mr-auto border-r' : 'ml-auto border-l'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="panel-title mb-0">{title}</span>
              <button className="btn px-2 py-0.5 text-xs" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            {children}
          </aside>
        </div>
      )}
    </>
  );
}

/** Overlay plein écran affiché uniquement en orientation portrait. */
export function PortraitOverlay() {
  return (
    <div className="portrait-overlay fixed inset-0 z-50 flex-col items-center justify-center gap-4 bg-abyss text-center">
      <span className="glow-text text-5xl text-neon-cyan">⟳</span>
      <p className="text-sm tracking-widest text-ink uppercase">
        Tournez l'écran
        <br />
        <span className="text-ink-dim normal-case">
          la console se joue en paysage
        </span>
      </p>
    </div>
  );
}
