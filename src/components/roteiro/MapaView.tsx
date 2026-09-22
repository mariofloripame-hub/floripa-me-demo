"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { BottomNav } from "@/components/nav/BottomNav";
import { categoryIconOptions } from "@/lib/itinerary/mapIcons";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";

interface MapaViewProps {
  slug: string;
  days: ItineraryDay[];
  nearby: NearbyPlace[];
}

const DEFAULT_CENTER: [number, number] = [-27.5954, -48.548];
const VOYAGER_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const VOYAGER_ATTRIBUTION = '&copy; <a href="https://carto.com/attributions">CARTO</a>';

export function MapaView({ slug, days, nearby }: MapaViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const leafletMapRef = useRef<Leaflet.Map | null>(null);
  const stopMarkersRef = useRef<Leaflet.Marker[]>([]);
  const suggestionMarkersRef = useRef<Leaflet.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(mapRef.current).setView(DEFAULT_CENTER, 12);
      L.tileLayer(VOYAGER_TILE_URL, { attribution: VOYAGER_ATTRIBUTION, maxZoom: 19 }).addTo(map);
      leafletMapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = leafletMapRef.current;
    if (!ready || !L || !map) return;

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    const activities = days
      .flatMap((d) => d.activities)
      .filter((a): a is typeof a & { lat: number; lng: number } => a.lat !== null && a.lng !== null);

    activities.forEach((act) => {
      const marker = L.marker([act.lat, act.lng], {
        icon: L.divIcon(categoryIconOptions(act.category, act.is_partner ? "partner" : "stop")),
      })
        .addTo(map)
        .bindPopup(act.name);
      stopMarkersRef.current.push(marker);
    });

    if (activities.length > 0) {
      map.fitBounds(
        L.latLngBounds(activities.map((a) => [a.lat, a.lng])),
        { padding: [40, 40], maxZoom: 15 },
      );
    } else {
      map.setView(DEFAULT_CENTER, 12);
    }
  }, [ready, days]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = leafletMapRef.current;
    if (!ready || !L || !map) return;

    suggestionMarkersRef.current.forEach((m) => m.remove());
    suggestionMarkersRef.current = [];

    nearby
      .filter((p): p is typeof p & { lat: number; lng: number } => p.lat !== null && p.lng !== null)
      .forEach((place) => {
        const marker = L.marker([place.lat, place.lng], {
          icon: L.divIcon(categoryIconOptions(place.category, "suggestion")),
        })
          .addTo(map)
          .bindPopup(place.name);
        suggestionMarkersRef.current.push(marker);
      });
  }, [ready, nearby]);

  return (
    <main className="relative min-h-screen pb-24">
      <div ref={mapRef} className="h-[calc(100vh-64px)] w-full bg-graphite-deep" />
      <BottomNav slug={slug} />
    </main>
  );
}
