// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BadgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="9.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 14.5 7.5 21l4.5-2.4 4.5 2.4-1.5-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 9.5a2 2 0 0 1 0-4V4.5A1.5 1.5 0 0 1 4.5 3h15A1.5 1.5 0 0 1 21 4.5v1a2 2 0 0 1 0 4v1a2 2 0 0 1 0 4v1a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5v-1a2 2 0 0 1 0-4v-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M13 4v16" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2" />
    </svg>
  );
}

function FeatureItem({
  icon: Icon,
  label,
}: {
  icon: (props: { className?: string }) => React.JSX.Element;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-graphite/60 text-turquoise ring-1 ring-ink/10">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-ink-dim">{label}</span>
    </li>
  );
}

export default function WelcomePage() {
  const [lastSlug, setLastSlug] = useState<string | null>(null);

  useEffect(() => {
    setLastSlug(window.localStorage.getItem("floripa_last_itinerary_slug"));
  }, []);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-graphite text-ink">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Image
          src="/images/bridge-sunset.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(11,20,22,0.9)_0%,rgba(11,20,22,0.5)_20%,rgba(11,20,22,0.22)_38%,rgba(11,20,22,0.3)_60%,rgba(11,20,22,0.95)_92%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-6 pt-8">
        <span className="font-display text-xl font-extrabold [text-shadow:0_2px_10px_rgba(0,0,0,0.5)]">
          Floripa<span className="text-coral">.</span>
          <span className="text-turquoise">me</span>
        </span>

        <div className="mt-8 flex-1">
          <h1
            className="animate-fade-up font-display text-3xl font-extrabold leading-[1.05] [text-shadow:0_2px_16px_rgba(0,0,0,0.55)]"
            style={{ animationDelay: "0ms" }}
          >
            Descubra
            <br />
            Florianópolis
            <br />
            do{" "}
            <span className="relative inline-block text-turquoise">
              seu jeito
              <svg viewBox="0 0 120 12" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-full text-coral">
                <path
                  d="M2 8 Q30 2 60 7 T118 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
            .
          </h1>

          <p
            className="animate-fade-up mt-5 text-sm leading-relaxed text-ink-dim [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]"
            style={{ animationDelay: "120ms" }}
          >
            Responda 8 perguntas rápidas e ganhe
            <br />
            um roteiro completo com dicas reais,
            <br />
            melhores preços e rotas;
          </p>

          <ul
            className="animate-fade-up mt-6 flex flex-col gap-1 text-sm [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]"
            style={{ animationDelay: "240ms" }}
          >
            <FeatureItem icon={ClockIcon} label="Em menos de 2 minutos" />
            <FeatureItem icon={BadgeIcon} label="100% personalizado" />
            <FeatureItem icon={TicketIcon} label="Grátis e sem cadastro" />
          </ul>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full flex-col gap-2">
            <Link
              href="/quiz"
              className="w-full rounded-pill bg-gradient-to-r from-turquoise to-blue py-3 text-center text-sm font-display font-extrabold text-graphite shadow-lg shadow-turquoise/20 transition active:scale-[0.98]"
            >
              Criar meu roteiro →
            </Link>
            <button
              type="button"
              className="w-full rounded-pill border border-turquoise/50 bg-transparent py-2 text-center text-xs font-display font-bold text-turquoise transition hover:bg-turquoise/10 active:scale-[0.98]"
            >
              Sou de Floripa
            </button>
          </div>
          <div className="flex items-start justify-center gap-2 text-xs text-ink-dim [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            <span className="mt-0.5 flex -space-x-1.5 shrink-0" aria-hidden>
              <span className="h-4 w-4 rounded-full bg-turquoise ring-2 ring-graphite" />
              <span className="h-4 w-4 rounded-full bg-blue ring-2 ring-graphite" />
              <span className="h-4 w-4 rounded-full bg-coral ring-2 ring-graphite" />
            </span>
            <p className="text-left">
              Junte-se a milhares de viajantes
              <br />
              que já <span className="text-turquoise">Exploram Floripa</span>
            </p>
          </div>
          {lastSlug && (
            <Link
              href={`/roteiro/${lastSlug}`}
              className="text-sm text-ink-dim underline decoration-ink-dim/40 underline-offset-4 transition hover:text-turquoise"
            >
              Continuar meu último roteiro
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
