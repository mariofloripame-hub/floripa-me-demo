"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Place } from "@/lib/supabase/types";
import { getPlaceImage } from "@/lib/itinerary/placeImages";
import { dayKey } from "@/lib/time/saoPaulo";
import {
  buildAvailabilityMessage, defaultGuests, MAX_GUESTS, MIN_GUESTS, validateStay, whatsappLink,
} from "@/lib/hospedagem/contact";
import { EstablishmentModal, placeToDetail, type EstablishmentDetail } from "./EstablishmentModal";

type Channel = "whatsapp" | "site";

function hiddenKey(slug: string): string {
  return `floripa_lodging_hidden_${slug}`;
}

function readHidden(slug: string): boolean {
  try {
    return window.localStorage.getItem(hiddenKey(slug)) === "1";
  } catch {
    return false;
  }
}

function writeHidden(slug: string) {
  try {
    window.localStorage.setItem(hiddenKey(slug), "1");
  } catch {
    // storage blocked (private mode) — the card just hides for this visit
  }
}

const primaryClass = "flex flex-1 items-center justify-center leading-tight rounded-pill bg-coral px-4 py-3 text-center text-sm font-display font-extrabold text-graphite";
const secondaryClass = "flex flex-1 items-center justify-center leading-tight rounded-pill border border-white/30 px-4 py-3 text-center text-sm font-bold text-ink";
const inputClass = "mt-1 w-full rounded-lg border border-white/20 bg-graphite/60 px-3 py-2 text-sm text-ink [color-scheme:dark]";

export function LodgingCard({ slug, options, group }: { slug: string; options: Place[]; group?: string }) {
  const [hidden, setHidden] = useState(false);
  const [featuredId, setFeaturedId] = useState(options[0]?.id);
  const [showOthers, setShowOthers] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(defaultGuests(group));
  const [detail, setDetail] = useState<EstablishmentDetail | null>(null);

  useEffect(() => {
    setHidden(readHidden(slug));
  }, [slug]);

  const featured = options.find((p) => p.id === featuredId) ?? options[0];
  if (!featured || hidden) return null;

  const others = options.filter((p) => p.id !== featured.id);
  const today = dayKey(new Date());
  const stayError = validateStay({ checkIn, checkOut }, today);
  const message = buildAvailabilityMessage({ checkIn, checkOut, guests });
  const whatsappHref = whatsappLink(featured.booking_whatsapp, message);
  const siteHref = featured.booking_url?.trim() || null;

  function track(channel: Channel) {
    fetch("/api/lodging-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        slug,
        place_id: featured.id,
        channel,
        check_in: checkIn || null,
        check_out: checkOut || null,
        guests,
      }),
    }).catch(() => {
      // tracking never blocks the tourist
    });
  }

  function contactButton(label: string, href: string | null, channel: Channel, primary: boolean) {
    if (!href) return null;
    const className = primary ? primaryClass : secondaryClass;
    if (stayError) {
      return (
        <button type="button" disabled className={`${className} opacity-50`}>
          {label}
        </button>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => track(channel)} className={className}>
        {label}
      </a>
    );
  }

  return (
    <section className="rounded-card border-2 border-turquoise/60 bg-white/10 p-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-turquoise">🏨 Onde ficar</h2>

      <button type="button" onClick={() => setDetail(placeToDetail(featured))} className="mt-3 flex w-full gap-3 text-left">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-graphite">
          <Image src={getPlaceImage(featured.name, featured.photos[0])} alt={featured.name} fill sizes="96px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-pill bg-turquoise px-2 py-0.5 text-[10px] font-bold text-graphite">
            Indicado pelo Floripa.My
          </span>
          <p className="mt-1 font-display text-base font-bold">{featured.name}</p>
          <p className="text-xs text-ink-dim">
            {featured.neighborhood} · {featured.price_range}
            {featured.rating ? ` · ⭐ ${featured.rating.toFixed(1).replace(".", ",")}` : ""}
          </p>
        </div>
      </button>

      {featured.partner_offer && (
        <p className="mt-3 rounded-lg bg-coral/15 px-3 py-2 text-xs font-bold text-coral">🏷️ {featured.partner_offer}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-dim">
          Entrada
          <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputClass} />
        </label>
        <label className="text-xs text-ink-dim">
          Saída
          <input type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-ink-dim">Hóspedes</span>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Menos hóspedes" disabled={guests <= MIN_GUESTS} onClick={() => setGuests((g) => g - 1)} className="h-8 w-8 rounded-full border border-white/30 disabled:opacity-40">−</button>
          <span aria-live="polite" className="w-6 text-center font-bold">{guests}</span>
          <button type="button" aria-label="Mais hóspedes" disabled={guests >= MAX_GUESTS} onClick={() => setGuests((g) => g + 1)} className="h-8 w-8 rounded-full border border-white/30 disabled:opacity-40">+</button>
        </div>
      </div>

      {stayError && <p className="mt-2 text-xs font-bold text-coral">{stayError}</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {contactButton("Consultar disponibilidade", whatsappHref, "whatsapp", true)}
        {contactButton("Reservar pelo site", siteHref, "site", !whatsappHref)}
      </div>

      {others.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowOthers((v) => !v)} className="text-xs font-bold text-turquoise">
            Ver outras opções
          </button>
          {showOthers && (
            <div className="mt-2 flex flex-col gap-2">
              {others.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => {
                    setFeaturedId(place.id);
                    setShowOthers(false);
                  }}
                  className="flex items-center gap-3 rounded-card border border-white/10 bg-graphite/40 p-2 text-left"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-graphite">
                    <Image src={getPlaceImage(place.name, place.photos[0])} alt={place.name} fill sizes="48px" className="object-cover" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{place.name}</span>
                    <span className="block text-xs text-ink-dim">
                      {place.neighborhood} · {place.price_range}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          writeHidden(slug);
          setHidden(true);
        }}
        className="mt-3 block text-xs text-ink-dim underline"
      >
        Já resolvi minha hospedagem
      </button>

      <EstablishmentModal detail={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
