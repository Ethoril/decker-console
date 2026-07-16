import { useState } from 'react';

/**
 * Champ texte contrôlé localement, commité à la RTDB au blur / Entrée
 * (évite un aller-retour réseau par frappe).
 */
export function CommitField({
  label,
  value,
  onCommit,
  textarea = false,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  textarea?: boolean;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const commit = () => {
    if (local !== value) onCommit(local);
  };
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-[10px] tracking-wider text-ink-dim uppercase">
        {label}
      </span>
      {textarea ? (
        <textarea
          className="field min-h-16 resize-y"
          value={local}
          placeholder={placeholder}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          className="field"
          value={local}
          placeholder={placeholder}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      )}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (v: T) => void;
}) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-[10px] tracking-wider text-ink-dim uppercase">
        {label}
      </span>
      <select
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Stepper numérique tactile (+/−). */
export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <span className="mb-1 block text-[10px] tracking-wider text-ink-dim uppercase">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="btn px-3 py-1"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <span className="min-w-8 text-center text-neon-cyan">{value}</span>
        <button
          className="btn px-3 py-1"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className={`btn mb-2 w-full text-left text-xs ${value ? 'btn-cyan active' : ''}`}
      aria-pressed={value}
      onClick={() => onChange(!value)}
    >
      {value ? '◉' : '○'} {label}
    </button>
  );
}
