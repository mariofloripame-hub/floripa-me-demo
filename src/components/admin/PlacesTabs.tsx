"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Place } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";

type Tab = "pendentes" | "aprovados" | "parceiros" | "todos";

const TABS: { value: Tab; label: string }[] = [
  { value: "pendentes", label: "Pendentes" },
  { value: "aprovados", label: "Aprovados" },
  { value: "parceiros", label: "Parceiros" },
  { value: "todos", label: "Todos" },
];

function matchesTab(place: Place, tab: Tab): boolean {
  if (tab === "todos") return true;
  if (tab === "pendentes") return !place.is_verified;
  if (tab === "parceiros") return place.is_partner;
  return place.is_verified && !place.is_partner;
}

export function PlacesTabs({ initialPlaces }: { initialPlaces: Place[] }) {
  const router = useRouter();
  const [places, setPlaces] = useState(initialPlaces);
  const [tab, setTab] = useState<Tab>("pendentes");
  const [error, setError] = useState<string | null>(null);

  function handleActionFailure(status: number) {
    if (status === 401) {
      router.push("/admin/login");
      return;
    }
    setError("Não foi possível concluir a ação. Tente novamente.");
  }

  async function handleApprove(id: string) {
    setError(null);
    const response = await fetch(`/api/admin/places/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_verified: true }),
    });
    if (!response.ok) {
      handleActionFailure(response.status);
      return;
    }
    setPlaces((current) => current.map((p) => (p.id === id ? { ...p, is_verified: true } : p)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esse estabelecimento? Essa ação não pode ser desfeita.")) return;
    setError(null);
    const response = await fetch(`/api/admin/places/${id}`, { method: "DELETE" });
    if (!response.ok) {
      handleActionFailure(response.status);
      return;
    }
    setPlaces((current) => current.filter((p) => p.id !== id));
  }

  const visible = places.filter((p) => matchesTab(p, tab));

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-pill px-4 py-2 text-sm font-bold ${
              tab === t.value ? "bg-teal-ink text-sand" : "bg-white text-teal-ink/60"
            }`}
          >
            {t.label} ({places.filter((p) => matchesTab(p, t.value)).length})
          </button>
        ))}
      </div>
      <Link href="/admin/estabelecimentos/novo">
        <Button type="button">Novo estabelecimento</Button>
      </Link>
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex flex-col gap-3">
        {visible.length === 0 && <p className="text-sm text-teal-ink/60">Nada por aqui.</p>}
        {visible.map((place) => (
          <div
            key={place.id}
            className="flex items-center justify-between rounded-card border border-teal-ink/10 bg-white p-4"
          >
            <div>
              <p className="font-bold text-teal-ink">{place.name}</p>
              <p className="text-xs text-teal-ink/60">
                {place.category} · {place.neighborhood}, {place.region}
              </p>
            </div>
            <div className="flex gap-2">
              {!place.is_verified && (
                <button
                  type="button"
                  onClick={() => handleApprove(place.id)}
                  className="rounded-pill bg-turquoise/20 px-3 py-1 text-xs font-bold text-turquoise-deep"
                >
                  Aprovar
                </button>
              )}
              <Link
                href={`/admin/estabelecimentos/${place.id}`}
                className="rounded-pill bg-teal-ink/10 px-3 py-1 text-xs font-bold text-teal-ink"
              >
                Editar
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(place.id)}
                className="rounded-pill bg-coral/10 px-3 py-1 text-xs font-bold text-coral-deep"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
