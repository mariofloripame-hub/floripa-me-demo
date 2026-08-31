"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { BottomNav } from "@/components/nav/BottomNav";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { Place } from "@/lib/supabase/types";

interface MapaViewProps {
  slug: string;
  days: ItineraryDay[];
  nearby: Place[];
}

const DEFAULT_CENTER = { lat: -27.5954, lng: -48.548 };

export function MapaView({ slug, days, nearby }: MapaViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setStatusMessage("Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver o mapa.");
      return;
    }
    if (!mapRef.current) return;

    const loader = new Loader({ apiKey, version: "weekly" });
    loader
      .load()
      .then((google) => {
        const activities = days.flatMap((d) => d.activities).filter((a) => a.lat !== null && a.lng !== null);
        const center = activities[0] ? { lat: activities[0].lat as number, lng: activities[0].lng as number } : DEFAULT_CENTER;
        const map = new google.maps.Map(mapRef.current as HTMLDivElement, { center, zoom: 12 });

        for (const act of activities) {
          new google.maps.Marker({
            position: { lat: act.lat as number, lng: act.lng as number },
            map,
            title: act.name,
            label: act.is_partner ? "⭐" : undefined,
          });
        }
        for (const place of nearby) {
          if (place.lat === null || place.lng === null) continue;
          new google.maps.Marker({ position: { lat: place.lat, lng: place.lng }, map, title: place.name, opacity: 0.7 });
        }
      })
      .catch(() => setStatusMessage("Não foi possível carregar o mapa agora."));
  }, [days, nearby]);

  return (
    <main className="relative min-h-screen pb-24">
      <div ref={mapRef} className="h-[calc(100vh-64px)] w-full bg-graphite-deep" />
      {statusMessage && <p className="absolute inset-x-0 top-1/2 px-6 text-center text-sm text-ink-dim">{statusMessage}</p>}
      <BottomNav slug={slug} />
    </main>
  );
}
