export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="h-1 w-full rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-turquoise to-blue transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
