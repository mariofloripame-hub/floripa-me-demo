"use client";

import { useState } from "react";
import { GlowBackground } from "@/components/ui/GlowBackground";
import { BottomNav } from "@/components/nav/BottomNav";
import { DayCard } from "./DayCard";
import type { ItineraryRow } from "@/lib/supabase/types";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

export function RoteiroView({ itinerary }: { itinerary: ItineraryRow }) {
  const [days, setDays] = useState(itinerary.days as ItineraryDay[]);

  async function handleRemove(dayNumber: number, placeId: string) {
    const previous = days;
    setDays((current) =>
      current
        .map((d) => (d.day_number === dayNumber ? { ...d, activities: d.activities.filter((a) => a.place_id !== placeId) } : d))
        .filter((d) => d.activities.length > 0),
    );
    const response = await fetch(`/api/itineraries/${itinerary.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_number: dayNumber, place_id: placeId }),
    });
    if (!response.ok) {
      setDays(previous);
      return;
    }
    const updated = await response.json();
    setDays(updated.days as ItineraryDay[]);
  }

  return (
    <main className="relative min-h-screen pb-24">
      <GlowBackground />
      <div className="relative px-6 pt-10">
        <p className="text-xs font-bold uppercase tracking-wide text-turquoise">Seu roteiro</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold">{itinerary.welcome_message}</h1>
      </div>
      <div className="relative mt-6 flex flex-col gap-4 px-4">
        {days.map((day) => (
          <DayCard key={day.day_number} day={day} onRemove={(placeId) => handleRemove(day.day_number, placeId)} />
        ))}
      </div>
      <BottomNav slug={itinerary.slug} />
    </main>
  );
}
