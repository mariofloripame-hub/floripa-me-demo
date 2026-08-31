// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function WelcomePage() {
  const [lastSlug, setLastSlug] = useState<string | null>(null);

  useEffect(() => {
    setLastSlug(window.localStorage.getItem("floripa_last_itinerary_slug"));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-display text-4xl font-extrabold leading-tight">
        Sua ilha,<br />seu jeito.
      </h1>
      <p className="max-w-xs text-sm text-ink-dim">
        Responda 8 perguntas rápidas e receba um roteiro completo em Florianópolis, feito por IA.
      </p>
      <Link
        href="/quiz"
        className="rounded-pill bg-gradient-to-r from-turquoise to-blue px-8 py-3 font-display font-extrabold text-graphite"
      >
        Começar →
      </Link>
      {lastSlug && (
        <Link href={`/roteiro/${lastSlug}`} className="text-sm text-ink-dim underline">
          Continuar meu último roteiro
        </Link>
      )}
    </main>
  );
}
