"use client";

import { useEffect, useState } from "react";

export const GENERATING_STEPS = [
  "Filtrando os melhores lugares pro seu perfil",
  "Nosso guia local (IA) está montando seu roteiro",
  "Organizando por dia e horário",
  "Últimos retoques...",
];

const STEP_INTERVAL_MS = 1100;

export function GeneratingOverlay() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((step) => (step < GENERATING_STEPS.length - 1 ? step + 1 : step));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-8 py-12">
      <span className="font-display text-lg font-extrabold text-ink">Montando seu roteiro...</span>
      <ul className="w-full max-w-xs space-y-4">
        {GENERATING_STEPS.map((step, index) => {
          const done = index < activeStep;
          const active = index === activeStep;
          return (
            <li
              key={step}
              className={`flex items-center gap-3 text-sm transition-colors ${
                done || active ? "text-ink" : "text-ink-dim"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  done ? "border-turquoise bg-turquoise/20 text-turquoise" : "border-white/20"
                }`}
              >
                {done ? "✓" : active ? "…" : ""}
              </span>
              {step}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
