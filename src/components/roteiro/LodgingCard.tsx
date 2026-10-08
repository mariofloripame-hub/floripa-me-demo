"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Place } from "@/lib/supabase/types";
import { getPlaceImage } from "@/lib/itinerary/placeImages";
import { dayKey } from "@/lib/time/saoPaulo";
import {
  bookingSearchUrl, buildAvailabilityMessage, defaultGuests, MAX_GUESTS, MIN_GUESTS, validateStay, whatsappLink,
} from "@/lib/hospedagem/contact";
import { cardHighlights } from "@/lib/hospedagem/highlights";
import { priceBadge } from "@/lib/places/priceLabel";
import { EstablishmentModal, lodgingToDetail, type EstablishmentDetail } from "./EstablishmentModal";

// Booking.com affiliate id, set in Vercel once the affiliate account exists.
const BOOKING_AFFILIATE_ID = process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID;

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

const primaryClass =
  "flex w-full items-center justify-center rounded-pill bg-coral px-4 py-2.5 text-sm font-extrabold text-graphite";
const secondaryClass =
  "flex w-full items-center justify-center rounded-pill border border-white/20 px-4 py-2 text-xs font-bold text-ink";
// The native picker icon is stretched invisibly over the whole field, so a tap
// anywhere opens the calendar while our own icon shows on the left.
const dateInputClass =
  "relative mt-1 w-full rounded-lg border border-white/15 bg-graphite/60 py-2 pl-8 pr-2 text-sm text-ink [color-scheme:dark] " +
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 " +
  "[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full " +
  "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";
const stepperClass =
  "flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-sm disabled:opacity-40";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="pointer-events-none absolute bottom-2.5 left-2.5 z-10 h-4 w-4 text-ink-dim">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4 shrink-0 text-ink-dim">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 4.8a3.3 3.3 0 0 1 0 6.4M17.5 14.8c2 .6 3.4 2.2 4 4.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

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

  const highlights = cardHighlights(featured.highlights ?? [], group);

  return (
    <section className="rounded-card border border-turquoise/30 bg-white/5 p-3">
      <h2 className="font-display text-xs font-extrabold uppercase tracking-wide text-turquoise">🏨 Onde ficar</h2>

      <button
        type="button"
        onClick={() => setDetail(lodgingToDetail(featured))}
        className="relative mt-2 block h-44 w-full overflow-hidden rounded-lg text-left sm:h-52"
      >
        <Image
          src={getPlaceImage(featured.name, featured.photos[0])}
          alt={featured.name}
          fill
          sizes="(max-width: 640px) 100vw, 640px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(11,20,22,0.9)_0%,rgba(11,20,22,0.45)_40%,rgba(11,20,22,0)_70%)]" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <span className="inline-block rounded-pill bg-turquoise px-2 py-0.5 text-[10px] font-bold text-graphite">
            Indicado pelo Floripa.My
          </span>
          <p className="mt-1 font-display text-base font-bold leading-tight">{featured.name}</p>
          <p className="text-xs text-ink-dim">
            {`${featured.neighborhood} · ${priceBadge(featured.price_range)}`}
          </p>
          {/* The bullet trails each item, so a wrapped line never starts with one. */}
          {highlights.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink">
              {highlights.map((item, index) => (
                <span key={item} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span>{item}</span>
                  {index < highlights.length - 1 && <span aria-hidden className="text-ink-dim">•</span>}
                </span>
              ))}
            </p>
          )}
        </div>
      </button>

      {featured.partner_offer && (
        <p className="mt-2 rounded-lg bg-coral/15 px-3 py-1.5 text-[11px] font-bold text-coral">🏷️ {featured.partner_offer}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="relative text-xs text-ink-dim">
          Entrada
          <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={dateInputClass} />
          <CalendarIcon />
        </label>
        <label className="relative text-xs text-ink-dim">
          Saída
          <input type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={dateInputClass} />
          <CalendarIcon />
        </label>
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/15 bg-graphite/60 py-1.5 pl-2.5 pr-1.5">
        <GuestsIcon />
        <span aria-live="polite" className="flex-1 text-sm">
          {guests === 1 ? "1 hóspede" : `${guests} hóspedes`}
        </span>
        <button type="button" aria-label="Menos hóspedes" disabled={guests <= MIN_GUESTS} onClick={() => setGuests((g) => g - 1)} className={stepperClass}>
          −
        </button>
        <button type="button" aria-label="Mais hóspedes" disabled={guests >= MAX_GUESTS} onClick={() => setGuests((g) => g + 1)} className={stepperClass}>
          +
        </button>
      </div>

      {stayError && <p className="mt-2 text-xs font-bold text-coral">{stayError}</p>}

      <div className="mt-3 flex flex-col gap-2">
        {contactButton("Consultar disponibilidade", whatsappHref, "whatsapp", true)}
        {contactButton("Reservar pelo site", siteHref, "site", !whatsappHref)}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowOthers((v) => !v)}
          className="mx-auto block text-xs font-bold text-turquoise"
        >
          Ver mais opções de hospedagem
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
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-graphite/40 p-2 text-left"
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-graphite">
                  <Image src={getPlaceImage(place.name, place.photos[0])} alt={place.name} fill sizes="44px" className="object-cover" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{place.name}</span>
                  <span className="block text-xs text-ink-dim">{`${place.neighborhood} · ${priceBadge(place.price_range)}`}</span>
                </span>
              </button>
            ))}
            <a
              href={bookingSearchUrl({ checkIn, checkOut, guests, affiliateId: BOOKING_AFFILIATE_ID })}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-left"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold">Ver mais no Booking.com</span>
                <span className="block text-xs text-ink-dim">Outras hospedagens em Florianópolis, com as suas datas</span>
              </span>
              <span aria-hidden className="text-ink-dim">↗</span>
            </a>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          writeHidden(slug);
          setHidden(true);
        }}
        className="mx-auto mt-2 block text-[11px] text-ink-dim underline"
      >
        Já resolvi minha hospedagem
      </button>

      <EstablishmentModal detail={detail} onClose={() => setDetail(null)} />
    </section>
  );
}
