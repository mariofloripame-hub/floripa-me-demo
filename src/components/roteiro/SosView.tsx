"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { BottomNav } from "@/components/nav/BottomNav";
import type { SosPlace } from "@/lib/supabase/types";

const CATEGORIES: { key: SosPlace["category"] | "todos"; label: string; icon: string }[] = [
  { key: "todos", label: "Todos", icon: "🆘" },
  { key: "saude", label: "Saúde", icon: "🏥" },
  { key: "seguranca", label: "Segurança", icon: "🚔" },
  { key: "veiculo", label: "Veículo", icon: "🛞" },
  { key: "financeiro", label: "Financeiro", icon: "🏧" },
];

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length <= 4 ? `tel:${digits}` : `tel:+55${digits}`;
}

export function SosView({ slug, places }: { slug: string; places: SosPlace[] }) {
  const [category, setCategory] = useState<SosPlace["category"] | "todos">("todos");
  const visible = category === "todos" ? places : places.filter((p) => p.category === category);

  return (
    <main className="relative min-h-screen pb-24">
      <div className="px-6 pt-10">
        <h1 className="font-display text-xl font-extrabold text-coral">🆘 SOS Floripa</h1>
        <p className="mt-1 text-xs text-ink-dim">Serviços essenciais perto de você</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c.key} selected={category === c.key} onClick={() => setCategory(c.key)}>
              {c.icon} {c.label}
            </Chip>
          ))}
        </div>
      </div>
      <ul className="mt-6 flex flex-col gap-2 px-4">
        {visible.map((place) => (
          <li key={place.id} className="rounded-card border border-white/10 bg-white/5 p-3">
            <div className="font-display text-sm font-bold">{place.name}</div>
            <div className="text-xs text-ink-dim">{place.meta}</div>
            {place.phone && (
              <a
                href={telHref(place.phone)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-turquoise"
              >
                📞 {place.phone}
              </a>
            )}
          </li>
        ))}
        {visible.length === 0 && <p className="text-sm text-ink-dim">Nenhum serviço nessa categoria ainda.</p>}
      </ul>
      <BottomNav slug={slug} />
    </main>
  );
}
