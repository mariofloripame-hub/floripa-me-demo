"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { BottomNav } from "@/components/nav/BottomNav";
import { categoryIconOptions } from "@/lib/itinerary/mapIcons";
import { STYLE_CATEGORIES } from "@/lib/itinerary/filterCandidates";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import type { NearbyPlace } from "@/lib/itinerary/nearbyPlaces";
import { EstablishmentModal, nearbyPlaceToDetail, type EstablishmentDetail } from "./EstablishmentModal";

interface MapaViewProps {
  slug: string;
  days: ItineraryDay[];
  nearby: NearbyPlace[];
}

const DEFAULT_CENTER: [number, number] = [-27.5954, -48.548];
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;
const VOYAGER_TILE_URL = CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`
  : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const VOYAGER_ATTRIBUTION = '&copy; <a href="https://carto.com/attributions">CARTO</a>';

function firstDayWithCoords(days: ItineraryDay[]): number {
  const dayWithCoords = days.find((d) => d.activities.some((a) => a.lat !== null && a.lng !== null));
  return dayWithCoords?.day_number ?? days[0]?.day_number ?? 1;
}

const CATEGORY_CHIPS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "praia", label: "Praia" },
  { value: "gastronomia", label: "Gastronomia" },
  { value: "compras", label: "Compras" },
  { value: "cultura", label: "Cultura" },
];

function matchesCategory(chip: string, category: string): boolean {
  if (chip === "todos") return true;
  return (STYLE_CATEGORIES[chip] ?? []).includes(category);
}

export function MapaView({ slug, days: initialDays, nearby: initialNearby }: MapaViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const leafletMapRef = useRef<Leaflet.Map | null>(null);
  const stopMarkersRef = useRef<Leaflet.Marker[]>([]);
  const suggestionMarkersRef = useRef<Leaflet.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [days, setDays] = useState(initialDays);
  const [nearby, setNearby] = useState(initialNearby);
  const [detail, setDetail] = useState<EstablishmentDetail | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => firstDayWithCoords(initialDays));
  const [activeCategory, setActiveCategory] = useState("todos");
  const [sheetOpen, setSheetOpen] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

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

    const activeDay = days.find((d) => d.day_number === selectedDay);
    const activities = (activeDay?.activities ?? []).filter(
      (a): a is typeof a & { lat: number; lng: number } => a.lat !== null && a.lng !== null,
    );

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
  }, [ready, days, selectedDay]);

  const visibleSuggestions = useMemo(
    () =>
      nearby.filter(
        (p): p is typeof p & { lat: number; lng: number } =>
          p.lat !== null && p.lng !== null && matchesCategory(activeCategory, p.category),
      ),
    [nearby, activeCategory],
  );

  useEffect(() => {
    const L = leafletRef.current;
    const map = leafletMapRef.current;
    if (!ready || !L || !map) return;

    suggestionMarkersRef.current.forEach((m) => m.remove());
    suggestionMarkersRef.current = [];

    visibleSuggestions.forEach((place) => {
      const marker = L.marker([place.lat, place.lng], {
        icon: L.divIcon(categoryIconOptions(place.category, "suggestion")),
      }).addTo(map);
      marker.on("click", () => setDetail(nearbyPlaceToDetail(place)));
      suggestionMarkersRef.current.push(marker);
    });
  }, [ready, visibleSuggestions]);

  async function handleAddSuggestion(placeId: string) {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const response = await fetch(`/api/itineraries/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_number: selectedDay, add_place_id: placeId }),
      });
      if (!response.ok) return;
      const updated = await response.json();
      setDays(updated.days as ItineraryDay[]);
      setNearby((current) => current.filter((p) => p.id !== placeId));
      setDetail(null);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <main className="relative min-h-screen pb-24">
      <div ref={mapRef} className="isolate h-[calc(100vh-64px)] w-full bg-graphite-deep" />

      {days.length > 1 && (
        <div className="no-scrollbar absolute left-3 right-3 top-3 flex gap-2 overflow-x-auto">
          {days.map((day) => (
            <button
              key={day.day_number}
              type="button"
              onClick={() => setSelectedDay(day.day_number)}
              className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-bold shadow ${
                selectedDay === day.day_number ? "bg-turquoise text-graphite" : "bg-white/90 text-graphite"
              }`}
            >
              Dia {day.day_number}
            </button>
          ))}
        </div>
      )}

      <div
        className="no-scrollbar absolute left-3 right-3 flex gap-2 overflow-x-auto"
        style={{ top: days.length > 1 ? 56 : 12 }}
      >
        {CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setActiveCategory(chip.value)}
            className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-bold shadow ${
              activeCategory === chip.value ? "bg-turquoise text-graphite" : "bg-white/90 text-graphite"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {visibleSuggestions.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 rounded-t-2xl bg-graphite/95 px-3 pb-2 pt-2 shadow-lg">
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-label={sheetOpen ? "Recolher sugestões" : "Expandir sugestões"}
            className="mx-auto block h-1 w-9 rounded-full bg-white/30"
          />
          {sheetOpen && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {visibleSuggestions.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setDetail(nearbyPlaceToDetail(place))}
                  className="w-28 shrink-0 rounded-card bg-white/10 p-2 text-left"
                >
                  <p className="truncate text-xs font-bold text-ink">{place.name}</p>
                  <p className="truncate text-[10px] text-ink-dim">{place.category}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <EstablishmentModal
        detail={detail}
        onClose={() => setDetail(null)}
        onAdd={detail ? () => handleAddSuggestion(detail.id) : undefined}
        adding={isAdding}
      />

      <BottomNav slug={slug} />
    </main>
  );
}
