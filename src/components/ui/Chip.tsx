import type { ReactNode } from "react";

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-pill px-3 py-1.5 text-xs font-bold transition-colors ${
        selected ? "bg-turquoise text-graphite" : "bg-white/10 text-ink-dim"
      }`}
    >
      {children}
    </button>
  );
}
