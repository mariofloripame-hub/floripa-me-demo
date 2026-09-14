"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { BottomNav } from "@/components/nav/BottomNav";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";

interface MapaViewProps {
  slug: string;
  days: ItineraryDay[];
  nearby: NearbyPlace[];
}

const DEFAULT_CENTER: [number, number] = [-27.5954, -48.548];

function emojiIcon(L: typeof Leaflet, emoji: string, size: number): Leaflet.DivIcon {
  return L.divIcon({
    html: `<span style="font-size:${size}px;line-height:1">${emoji}</span>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

export function MapaView({ slug, days, nearby }: MapaViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    let map: Leaflet.Map | undefined;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      const activities = days.flatMap((d) => d.activities).filter((a) => a.lat !== null && a.lng !== null);
      const center: [number, number] = activities[0]
        ? [activities[0].lat as number, activities[0].lng as number]
        : DEFAULT_CENTER;

      map = L.map(mapRef.current).setView(center, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      for (const act of activities) {
        L.marker([act.lat as number, act.lng as number], { icon: emojiIcon(L, act.is_partner ? "⭐" : "📍", 28) })
          .addTo(map)
          .bindPopup(act.name);
      }
      for (const place of nearby) {
        if (place.lat === null || place.lng === null) continue;
        L.marker([place.lat, place.lng], { icon: emojiIcon(L, "·", 20), opacity: 0.7 })
          .addTo(map)
          .bindPopup(place.name);
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [days, nearby]);

  return (
    <main className="relative min-h-screen pb-24">
      <div ref={mapRef} className="h-[calc(100vh-64px)] w-full bg-graphite-deep" />
      <BottomNav slug={slug} />
    </main>
  );
}
