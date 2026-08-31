"use client";

import { GlowBackground } from "@/components/ui/GlowBackground";
import { BottomNav } from "@/components/nav/BottomNav";
import { DayCard } from "./DayCard";
import type { ItineraryRow } from "@/lib/supabase/types";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

export function RoteiroView({ itinerary }: { itinerary: ItineraryRow }) {
  const days = itinerary.days as ItineraryDay[];
  return (
    <main className="relative min-h-screen pb-24">
      <GlowBackground />
      <div className="relative px-6 pt-10">
        <p className="text-xs font-bold uppercase tracking-wide text-turquoise">Seu roteiro</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold">{itinerary.welcome_message}</h1>
      </div>
      <div className="relative mt-6 flex flex-col gap-4 px-4">
        {days.map((day) => (
          <DayCard key={day.day_number} day={day} />
        ))}
      </div>
      <BottomNav slug={itinerary.slug} />
    </main>
  );
}
