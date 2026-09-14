"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import type { ItineraryDay } from "@/lib/itinerary/assemble";
import { getPlaceImage } from "@/lib/itinerary/placeImages";

function priceBadge(priceRange: string): string {
  return priceRange === "Gratuito" ? "🎟️ Grátis" : `💰 ${priceRange}`;
}

function mapsUrl(act: { name: string; address: string; lat: number | null; lng: number | null }): string {
  const query =
    act.lat !== null && act.lng !== null ? `${act.lat},${act.lng}` : `${act.name} ${act.address}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const DISPLAY_NAME: Record<string, string> = {
  "Passeio Barco Costa Lagoa": "Barco Costa da Lagoa",
};

function displayName(name: string): string {
  return DISPLAY_NAME[name] ?? name;
}

const EXCLUSIVE_OFFER_PLACES = new Set(["Zilá", "Restaurante do Ceará"]);

const SUGGESTED_PARTNERS = [
  { name: "restaurante-01", image: "/images/restaurante-01.jpg" },
  { name: "restaurante-02", image: "/images/restaurante-02.jpg" },
  { name: "restaurante-03", image: "/images/restaurante-03.jpg" },
  { name: "restaurante-04", image: "/images/restaurante-04.jpg" },
];

function PartnerSuggestions() {
  return (
    <div className="rounded-card border border-white/10 bg-white/5 p-3">
      <h3 className="text-xs font-extrabold uppercase tracking-wide text-turquoise">
        ✦ Outras opções parceiras
      </h3>
      <div className="mt-2.5 flex gap-3 overflow-x-auto pb-1">
        {SUGGESTED_PARTNERS.map((partner) => (
          <div key={partner.name} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-graphite">
            <Image src={partner.image} alt={partner.name} fill sizes="112px" className="object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(11,20,22,0.9)_0%,rgba(11,20,22,0)_70%)] px-2 pb-1.5 pt-5">
              <span className="block truncate text-[11px] font-bold text-ink">{partner.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddActivityRow({ onAdd }: { onAdd: (input: { name: string; time: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [time, setTime] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 self-start rounded-pill border border-dashed border-white/20 px-3 py-1.5 text-xs font-bold text-ink-dim transition-colors hover:border-turquoise/50 hover:text-turquoise"
      >
        + Adicionar programação
      </button>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !time) return;
    onAdd({ name: name.trim(), time });
    setName("");
    setTime("");
    setOpen(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-2 rounded-card border border-white/10 bg-white/5 p-3">
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        required
        aria-label="Horário"
        className="rounded-pill border border-white/10 bg-graphite px-3 py-1.5 text-xs text-ink"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="O que você vai fazer?"
        required
        aria-label="Nome da programação"
        className="rounded-pill border border-white/10 bg-graphite px-3 py-1.5 text-xs text-ink placeholder:text-ink-dim"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-pill py-1.5 text-xs font-bold text-ink-dim"
        >
          Cancelar
        </button>
        <button type="submit" className="flex-1 rounded-pill bg-turquoise py-1.5 text-xs font-bold text-graphite">
          Adicionar
        </button>
      </div>
    </form>
  );
}

export function DayCard({
  day,
  onRemove,
  onAddActivity,
}: {
  day: ItineraryDay;
  onRemove?: (placeId: string) => void;
  onAddActivity?: (input: { name: string; time: string }) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden>☀️</span>
        <h2 className="font-display text-xs font-extrabold uppercase tracking-wide text-turquoise">
          Dia {day.day_number} — {day.theme}
        </h2>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="flex flex-col">
        {day.activities.map((act, index) => {
          const isLast = index === day.activities.length - 1;
          return (
            <div key={`${act.place_id}-${act.time}`} className="flex min-w-0 gap-2.5">
              <div className="w-9 shrink-0 pt-1.5 text-right text-[11px] font-bold text-ink-dim">{act.time}</div>
              <div className="flex shrink-0 flex-col items-center">
                <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-turquoise" aria-hidden />
                {!isLast && <span className="w-px flex-1 bg-white/15" aria-hidden />}
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <div className="relative flex gap-3 overflow-hidden rounded-card border border-white/10 bg-white/5 p-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-graphite">
                    <Image
                      src={getPlaceImage(act.name, act.photo)}
                      alt={act.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  {EXCLUSIVE_OFFER_PLACES.has(act.name) && (
                    <span className="absolute -left-14 top-6 w-48 -rotate-45 bg-coral py-0.5 text-center text-[9px] font-extrabold uppercase leading-none tracking-tight text-graphite shadow-md">
                      Oferta exclusiva
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-display text-sm font-bold">
                        {displayName(act.name)}
                      </span>
                      {act.is_partner && (
                        <span className="shrink-0 text-[10px] font-bold text-coral" title="Parceiro">
                          ⭐
                        </span>
                      )}
                      {onRemove && (
                        <button
                          type="button"
                          aria-label={`Remover ${act.name}`}
                          disabled={day.activities.length === 1}
                          title={
                            day.activities.length === 1
                              ? "Não é possível remover a última atividade do dia"
                              : undefined
                          }
                          onClick={() => {
                            if (window.confirm(`Remover "${displayName(act.name)}" da sua programação?`)) {
                              onRemove(act.place_id);
                            }
                          }}
                          className="shrink-0 text-ink-dim hover:text-alert disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ink-dim print:hidden"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <span className="mt-1 inline-block rounded-pill bg-turquoise/15 px-2 py-0.5 text-[10px] font-bold text-turquoise">
                      {act.category}
                    </span>
                    {act.short_description && (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-dim">{act.short_description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-pill bg-white/10 px-2 py-1 text-[10px] font-bold text-ink-dim">
                        {priceBadge(act.price_range)}
                      </span>
                      <a
                        href={mapsUrl(act)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-pill bg-white/10 px-2 py-1 text-[10px] font-bold text-turquoise print:hidden"
                      >
                        📍 Mapa
                      </a>
                      {act.category === "Gastronomia" && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-coral/15 px-2 py-1 text-[10px] font-bold text-coral print:hidden">
                          📅 Reservar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ml-[46px] mt-1">
        <PartnerSuggestions />
      </div>

      {onAddActivity && (
        <div className="ml-[46px] mt-3 flex flex-col print:hidden">
          <AddActivityRow onAdd={onAddActivity} />
        </div>
      )}
    </section>
  );
}
