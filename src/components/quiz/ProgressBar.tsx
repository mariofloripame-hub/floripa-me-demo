export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div>
      <div className="mb-1.5 text-right text-[11px] font-medium text-ink-dim">
        {current}/{total}
      </div>
      <div className="h-1 w-full rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-turquoise to-blue transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
