"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/nav/BottomNav";
import { DayCard } from "./DayCard";
import { HeroCarousel } from "./HeroCarousel";
import { getTripTitle, getTripChips } from "@/lib/itinerary/tripSummary";
import type { ItineraryRow, Place } from "@/lib/supabase/types";
import type { ItineraryDay } from "@/lib/itinerary/assemble";

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3v12M12 3l4 4M12 3 8 7M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className={className}>
      <path
        d="M12 20s-7-4.35-9.5-8.5C.7 8.2 2.3 5 5.5 5c1.8 0 3.2 1 4.5 2.5C11.3 6 12.7 5 14.5 5 17.7 5 19.3 8.2 21.5 11.5 19 15.65 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const HERO_IMAGES = [
  { src: "/images/ponte-alto.png" },
  { src: "/images/casal-praia.png" },
  { src: "/images/casal-jantar.png", focus: "72% 42%" },
];

const HERO_IMAGES_BY_GROUP: Record<string, { src: string; focus?: string }[]> = {
  familia: [
    { src: "/images/familia-01.png" },
    { src: "/images/familia-02.png" },
    { src: "/images/familia-03.png" },
  ],
  amigos: [
    { src: "/images/amigos-01.png" },
    { src: "/images/amigos-02.png" },
    { src: "/images/amigos-03.png" },
  ],
  solo: [
    { src: "/images/solo-negocios-01.png" },
    { src: "/images/solo-negocios-02.png" },
    { src: "/images/solo-negocios-03.png" },
  ],
};

const NOTICE_TIPS = [
  {
    icon: "🚕",
    label: "Uber/99",
    text: "costuma ser a forma mais prática de ir entre praias — o valor varia bastante conforme distância e horário, então confira o app antes de sair.",
  },
  {
    icon: "🅿️",
    label: "Estacionamento",
    text: "em pontos turísticos como Lagoa da Conceição e Centro, chegue cedo ou prefira deixar o carro na pousada e usar apps de transporte.",
  },
  {
    icon: "🕒",
    label: "Trânsito",
    text: "evite a Via Expressa/SC-401 no fim da tarde em dias úteis — costuma ser o horário de maior movimento da ilha.",
  },
  {
    icon: "☀️",
    label: "Cuidados",
    text: "leve protetor solar e água mesmo em dias nublados, e confira as condições do mar antes de entrar — várias praias têm correnteza forte.",
  },
];

function ImportantNotice() {
  const [expanded, setExpanded] = useState(false);
  const visibleTips = expanded ? NOTICE_TIPS : NOTICE_TIPS.slice(0, 1);

  return (
    <div className="rounded-card border border-coral/40 bg-coral/10 p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-coral">⚠️ Aviso importante</p>
      <ul className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-ink-dim">
        {visibleTips.map((tip) => (
          <li key={tip.label}>
            {tip.icon} <strong className="text-ink">{tip.label}:</strong> {tip.text}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-xs font-bold text-coral">
        {expanded ? "Ver menos ↑" : "Ver mais ↓"}
      </button>
    </div>
  );
}

function WelcomeMessage({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > 180;

  return (
    <div className="rounded-card border-l-4 border-turquoise bg-white/5 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-turquoise">👋 Olá!</p>
      <p className={`mt-2 text-sm leading-relaxed text-ink-dim ${!expanded && isLong ? "line-clamp-3" : ""}`}>
        {message}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-bold text-turquoise"
        >
          {expanded ? "Ver menos ↑" : "Ver mais ↓"}
        </button>
      )}
    </div>
  );
}

function PartnersSection({ partners }: { partners: Place[] }) {
  if (partners.length === 0) return null;

  return (
    <div className="rounded-card border border-turquoise/30 bg-turquoise/5 p-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-turquoise">
        ✦ Estabelecimentos parceiros
      </h2>
      <p className="mt-1 text-xs text-ink-dim">Lugares parceiros perto do seu roteiro — fique de olho nas promoções.</p>
      <div className="mt-3 flex flex-col gap-2">
        {partners.map((place) => (
          <div
            key={place.id}
            className="flex items-center justify-between gap-2 rounded-card border border-white/10 bg-graphite/40 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold">{place.name}</p>
              <p className="text-xs text-ink-dim">
                {place.category} · {place.neighborhood}
              </p>
            </div>
            {place.partner_offer && (
              <span className="shrink-0 rounded-pill bg-coral px-2 py-1 text-[10px] font-bold text-graphite">
                🏷️ {place.partner_offer}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoteiroView({
  itinerary,
  partners = [],
}: {
  itinerary: ItineraryRow;
  partners?: Place[];
}) {
  const [days, setDays] = useState(itinerary.days as ItineraryDay[]);
  const [favorite, setFavorite] = useState(false);

  const favoriteKey = `floripa_favorite_${itinerary.slug}`;

  useEffect(() => {
    setFavorite(window.localStorage.getItem(favoriteKey) === "1");
  }, [favoriteKey]);

  function toggleFavorite() {
    setFavorite((current) => {
      const next = !current;
      window.localStorage.setItem(favoriteKey, next ? "1" : "0");
      return next;
    });
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Meu roteiro em Floripa", url });
      } catch {
        // user cancelled the native share sheet — nothing to do
      }
      return;
    }
    await navigator.clipboard.writeText(url);
  }

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

  async function handleAddActivity(dayNumber: number, input: { name: string; time: string }) {
    const response = await fetch(`/api/itineraries/${itinerary.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_number: dayNumber, activity: input }),
    });
    if (!response.ok) return;
    const updated = await response.json();
    setDays(updated.days as ItineraryDay[]);
  }

  const answers = itinerary.quiz_answers;
  const title = getTripTitle(answers);
  const chips = getTripChips(answers);
  const group = typeof answers.group === "string" ? answers.group : "";
  const heroImages = HERO_IMAGES_BY_GROUP[group] ?? HERO_IMAGES;

  return (
    <main className="relative min-h-dvh bg-graphite pb-24 text-ink">
      <div className="relative h-[420px] w-full overflow-hidden">
        <HeroCarousel images={heroImages} />
        {/* Chips (📍 timing, 🏨 region, etc.) overlap the bottom ~30% of this
            box via a negative margin below — darken that band enough for
            legible white text over a bright photo, not just the very edge. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(11,20,22,0.45)_0%,rgba(11,20,22,0.05)_25%,rgba(11,20,22,0.25)_50%,rgba(11,20,22,0.55)_65%,rgba(11,20,22,0.95)_100%)]" />

        <div className="absolute inset-x-0 top-0 flex flex-col p-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                aria-label="Voltar"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-graphite/60 text-ink backdrop-blur transition-colors hover:bg-graphite/80"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
              <span className="font-display text-sm font-extrabold [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
                Floripa<span className="text-coral">.</span>
                <span className="text-turquoise">me</span>
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShare}
                aria-label="Compartilhar roteiro"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-graphite/60 text-ink backdrop-blur transition-colors hover:bg-graphite/80"
              >
                <ShareIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleFavorite}
                aria-label={favorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
                aria-pressed={favorite}
                className={`flex h-9 w-9 items-center justify-center rounded-full bg-graphite/60 backdrop-blur transition-colors hover:bg-graphite/80 ${
                  favorite ? "text-coral" : "text-ink"
                }`}
              >
                <HeartIcon className="h-4 w-4" filled={favorite} />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <span className="inline-flex items-center gap-1 rounded-pill border border-turquoise/40 bg-graphite/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-turquoise backdrop-blur">
              ✦ Roteiro exclusivo
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold [text-shadow:0_2px_16px_rgba(0,0,0,0.6)]">
              {title}
            </h1>
          </div>
        </div>
      </div>

      <div className="relative -mt-[140px] px-6">
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1.5 text-xs font-medium text-ink-dim"
              >
                <span aria-hidden>{chip.icon}</span>
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative mt-6 px-6">
        <WelcomeMessage message={itinerary.welcome_message} />
      </div>

      <div className="relative mt-4 px-6">
        <ImportantNotice />
      </div>

      <div className="relative mt-6 flex flex-col gap-6 px-6">
        {days.map((day) => (
          <DayCard
            key={day.day_number}
            day={day}
            partners={partners}
            onRemove={(placeId) => handleRemove(day.day_number, placeId)}
            onAddActivity={(input) => handleAddActivity(day.day_number, input)}
          />
        ))}
      </div>

      {partners.length > 0 && (
        <div className="relative mt-8 px-6">
          <PartnersSection partners={partners} />
        </div>
      )}

      <div className="relative mt-8 px-6 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex w-full items-center justify-center gap-2 rounded-pill border border-coral/40 bg-coral/15 py-3 text-sm font-display font-extrabold text-coral transition-colors hover:bg-coral/25"
        >
          📄 Gerar PDF
        </button>
      </div>

      <div className="print:hidden">
        <BottomNav slug={itinerary.slug} />
      </div>
    </main>
  );
}
