/** Rangée de cases de moniteur de condition (cochées depuis la gauche). */
export function MonitorBoxes({
  label,
  filled,
  total,
  color,
}: {
  label: string;
  filled: number;
  total: number;
  color: string; // classe de couleur des cases cochées
}) {
  return (
    <div className="mb-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-wider text-ink-dim uppercase">{label}</span>
        <span className="text-[10px] text-ink-dim">
          {filled}/{total}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-0.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-[2px] border ${
              i < filled ? `${color} border-transparent` : 'border-grid bg-abyss'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Cadran DIEU : brouillé en permanence, valeur révélée 10 s après « Vérifier ». */
export function DieuDial({
  surveillance,
  revealed,
}: {
  surveillance: number;
  revealed: boolean;
}) {
  return (
    <div className="rounded border border-grid bg-panel-2 p-2 text-center">
      <p className="text-[10px] tracking-widest text-ink-dim uppercase">Signal DIEU</p>
      {revealed ? (
        <p className="glow-text mt-1 text-lg tracking-[0.3em] text-neon-red">
          {'█'.repeat(surveillance)}
          {'░'.repeat(3 - surveillance)} {surveillance}/3
        </p>
      ) : (
        <p className="mt-1 text-lg tracking-[0.3em] text-neon-red opacity-60">▓▓▓</p>
      )}
    </div>
  );
}
