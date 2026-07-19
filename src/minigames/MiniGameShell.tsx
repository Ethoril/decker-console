import type { ReactNode } from 'react';

export function MiniGameShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-abyss">
      <header className="flex shrink-0 items-center justify-between border-b border-neon-magenta/40 bg-panel px-4 py-2">
        <div>
          <p className="glow-text text-sm tracking-[0.2em] text-neon-magenta uppercase">
            {title}
          </p>
          <p className="text-[10px] text-ink-dim">{subtitle}</p>
        </div>
        <span className="pulse-slow text-xs text-neon-cyan">CANAL ACTIF</span>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-3">{children}</main>
    </div>
  );
}
