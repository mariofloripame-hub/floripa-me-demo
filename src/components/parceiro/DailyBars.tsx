import type { DayCount } from "@/lib/parceiro/dashboard";

const LABEL_EVERY = 5;

export function DailyBars({ data, label }: { data: DayCount[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure aria-label={label} className="flex flex-col gap-1">
      <div className="flex h-24 items-end gap-[2px]">
        {data.map((d) => (
          <div
            key={d.dayKey}
            title={`Dia ${d.label}: ${d.count}`}
            aria-label={`Dia ${d.label}: ${d.count}`}
            className="flex-1 rounded-t-[4px] bg-turquoise-deep/80"
            style={{ height: d.count === 0 ? "2px" : `${(d.count / max) * 100}%`, opacity: d.count === 0 ? 0.2 : 1 }}
          />
        ))}
      </div>
      <div className="flex gap-[2px] text-[9px] text-teal-ink/50">
        {data.map((d, index) => (
          <span key={d.dayKey} className="flex-1 text-center">
            {index === 0 || (index + 1) % LABEL_EVERY === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
