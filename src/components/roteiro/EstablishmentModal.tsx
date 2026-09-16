"use client";

import { useEffect } from "react";
import Image from "next/image";
import { getPlaceImage } from "@/lib/itinerary/placeImages";
import type { Place } from "@/lib/supabase/types";

export interface EstablishmentDetail {
  name: string;
  category: string;
  price_range: string;
  address: string;
  short_description?: string;
  photos: string[];
  rating: number | null;
  google_place_id: string | null;
  partner_offer?: string | null;
  lat: number | null;
  lng: number | null;
}

export function placeToDetail(place: Place): EstablishmentDetail {
  return {
    name: place.name,
    category: place.category,
    price_range: place.price_range,
    address: place.address,
    short_description: place.short_description,
    photos: place.photos,
    rating: place.rating,
    google_place_id: place.google_place_id,
    partner_offer: place.partner_offer,
    lat: place.lat,
    lng: place.lng,
  };
}

function priceBadge(priceRange: string): string {
  return priceRange === "Gratuito" ? "🎟️ Grátis" : `💰 ${priceRange}`;
}

function mapsUrl(detail: EstablishmentDetail): string {
  const query =
    detail.lat !== null && detail.lng !== null
      ? `${detail.lat},${detail.lng}`
      : `${detail.name} ${detail.address}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function reviewsUrl(googlePlaceId: string): string {
  return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(googlePlaceId)}`;
}

export function EstablishmentModal({
  detail,
  onClose,
}: {
  detail: EstablishmentDetail | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!detail) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detail, onClose]);

  if (!detail) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={detail.name}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-graphite p-5 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold text-ink">{detail.name}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="shrink-0 text-lg text-ink-dim hover:text-ink"
          >
            ✕
          </button>
        </div>

        {detail.photos.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {detail.photos.map((photo) => (
              <div key={photo} className="relative h-32 w-44 shrink-0 overflow-hidden rounded-lg bg-black/20">
                <Image
                  src={getPlaceImage(detail.name, photo)}
                  alt={detail.name}
                  fill
                  sizes="176px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-pill bg-turquoise/15 px-2 py-0.5 text-[11px] font-bold text-turquoise">
            {detail.category}
          </span>
          <span className="rounded-pill bg-white/10 px-2 py-1 text-[11px] font-bold text-ink-dim">
            {priceBadge(detail.price_range)}
          </span>
          {typeof detail.rating === "number" && (
            <span className="rounded-pill bg-white/10 px-2 py-1 text-[11px] font-bold text-ink-dim">
              ⭐ {detail.rating.toFixed(1)}
            </span>
          )}
        </div>

        {detail.partner_offer && (
          <div className="mt-3 rounded-card bg-coral/15 px-3 py-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-coral">🏷️ Promoção exclusiva</p>
            <p className="mt-0.5 text-sm text-ink">{detail.partner_offer}</p>
          </div>
        )}

        {detail.short_description && <p className="mt-3 text-sm text-ink-dim">{detail.short_description}</p>}

        {detail.address && <p className="mt-2 text-xs text-ink-dim">📍 {detail.address}</p>}

        <div className="mt-4 flex gap-2">
          <a
            href={mapsUrl(detail)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-pill bg-white/10 py-2 text-center text-xs font-bold text-turquoise"
          >
            📍 Ver no mapa
          </a>
          {detail.google_place_id && (
            <a
              href={reviewsUrl(detail.google_place_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-pill bg-white/10 py-2 text-center text-xs font-bold text-turquoise"
            >
              ⭐ Ver avaliações
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
