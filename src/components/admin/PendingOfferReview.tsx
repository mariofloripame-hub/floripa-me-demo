"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Place } from "@/lib/supabase/types";
import { hasPendingOffer, isPendingRemoval, type OfferDecision } from "@/lib/ofertas/pendingOffer";
import { formatDayMonth } from "@/lib/time/saoPaulo";

type ReviewPlace = Pick<Place, "id" | "partner_offer" | "pending_offer" | "pending_offer_submitted_at">;

export function PendingOfferReview({ place }: { place: ReviewPlace }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fields = { pending_offer: place.pending_offer ?? null, pending_offer_submitted_at: place.pending_offer_submitted_at ?? null };
  if (!hasPendingOffer(fields)) return null;

  async function decide(action: OfferDecision) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/places/${place.id}/oferta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (response.status === 401) {
      router.push("/admin/login");
      return;
    }
    if (!response.ok) {
      setError("Não foi possível salvar a decisão. Tente novamente.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-6 flex flex-col gap-3 rounded-card border border-coral/30 bg-coral/5 p-4">
      <p className="text-sm font-bold text-coral-deep">
        🎁 Oferta enviada pelo parceiro em {formatDayMonth(new Date(fields.pending_offer_submitted_at!))}
      </p>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase text-teal-ink/50">No ar agora</p>
          <p>{place.partner_offer?.trim() || "Nenhuma"}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-teal-ink/50">Proposta</p>
          <p className="font-bold">{isPendingRemoval(fields) ? "Pedido de remoção da cortesia" : fields.pending_offer}</p>
        </div>
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("aprovar")}
          className="rounded-pill bg-turquoise/20 px-4 py-1.5 text-xs font-bold text-turquoise-deep disabled:opacity-40"
        >
          Aprovar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("recusar")}
          className="rounded-pill bg-coral/10 px-4 py-1.5 text-xs font-bold text-coral-deep disabled:opacity-40"
        >
          Recusar
        </button>
      </div>
    </section>
  );
}
