"use client";

import { BottomNav } from "@/components/nav/BottomNav";
import type { EventRow } from "@/lib/supabase/types";

const MONTH_NAMES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function DicasView({ slug, events }: { slug: string; events: EventRow[] }) {
  return (
    <main className="relative min-h-screen pb-24">
      <div className="px-6 pt-10">
        <h1 className="font-display text-xl font-extrabold">Dicas pra você</h1>
        <p className="mt-1 text-xs text-ink-dim">Eventos em cartaz durante sua viagem</p>
      </div>
      <ul className="mt-6 flex flex-col gap-3 px-4">
        {events.map((event) => (
          <li key={event.id} className="rounded-card border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-bold text-turquoise">
              {MONTH_NAMES[event.start_month]}
              {event.end_month !== event.start_month ? `–${MONTH_NAMES[event.end_month]}` : ""}
            </div>
            <div className="mt-1 font-display text-sm font-bold">{event.name}</div>
            <div className="text-xs text-ink-dim">{event.location}</div>
            {event.notes && <p className="mt-2 text-xs text-ink-dim">{event.notes}</p>}
          </li>
        ))}
        {events.length === 0 && (
          <p className="text-sm text-ink-dim">Nenhum evento em cartaz no momento da sua viagem.</p>
        )}
      </ul>
      <BottomNav slug={slug} />
    </main>
  );
}
