import type { ItineraryDay } from "@/lib/itinerary/assemble";

export function DayCard({ day }: { day: ItineraryDay }) {
  return (
    <section className="rounded-card border border-white/10 bg-white/5 p-4">
      <h2 className="font-display text-xs font-extrabold uppercase tracking-wide text-turquoise">
        Dia {day.day_number} — {day.theme}
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {day.activities.map((act) => (
          <li key={`${act.place_id}-${act.time}`} className="flex items-center gap-3">
            <div className="w-12 shrink-0 text-xs text-ink-dim">{act.time}</div>
            <div className="flex-1">
              <div className="font-display text-sm font-bold">
                {act.name}
                {act.is_partner && <span className="ml-2 text-coral">⭐ Parceiro</span>}
              </div>
              <div className="text-xs text-ink-dim">
                {act.price_range} · {act.category}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
