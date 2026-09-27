"use client";

import { useState, type FormEvent } from "react";
import { MAX_OFFER_LENGTH } from "@/lib/ofertas/pendingOffer";

export function OfferCard({
  liveOffer,
  pendingOffer,
  hasPending,
}: {
  liveOffer: string | null;
  pendingOffer: string | null;
  hasPending: boolean;
}) {
  const [pending, setPending] = useState<{ has: boolean; text: string }>({ has: hasPending, text: pendingOffer ?? "" });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(text: string) {
    setSending(true);
    setError(null);
    const response = await fetch("/api/parceiro/oferta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    setSending(false);
    if (!response?.ok) {
      const body = response ? await response.json().catch(() => null) : null;
      setError(body?.error ?? "Não foi possível enviar. Tente de novo.");
      return;
    }
    const body = await response.json();
    setPending({ has: true, text: body.pending_offer ?? "" });
    setDraft("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) void submit(draft);
  }

  return (
    <section id="cortesia" className="flex flex-col gap-3 rounded-card border border-teal-ink/10 bg-white p-5">
      <h2 className="font-display text-base font-extrabold">🎁 Minha cortesia</h2>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">No ar agora</p>
        <p className="text-sm">{liveOffer ?? "Nenhuma cortesia ativa"}</p>
      </div>
      {pending.has && (
        <p className="rounded-card bg-coral/10 p-3 text-sm text-coral-deep">
          Aguardando aprovação: {pending.text.trim() ? <strong>{pending.text}</strong> : "remover a cortesia"}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="nova-cortesia" className="text-sm font-bold">
          Nova cortesia
        </label>
        <textarea
          id="nova-cortesia"
          value={draft}
          maxLength={MAX_OFFER_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Ex.: Sobremesa cortesia no almoço"
          className="w-full rounded-card border border-teal-ink/15 px-3 py-2 text-sm"
        />
        <p className="self-end text-[11px] text-teal-ink/50">
          {draft.length}/{MAX_OFFER_LENGTH}
        </p>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-pill bg-teal-ink px-4 py-2 text-sm font-bold text-sand disabled:opacity-40"
          >
            Enviar para aprovação
          </button>
          {liveOffer && (
            <button
              type="button"
              disabled={sending}
              onClick={() => submit("")}
              className="rounded-pill bg-coral/10 px-4 py-2 text-sm font-bold text-coral-deep disabled:opacity-40"
            >
              Pedir remoção
            </button>
          )}
        </div>
        <p className="text-[11px] text-teal-ink/50">A equipe Floripa.My revisa antes de a cortesia aparecer nos roteiros.</p>
      </form>
    </section>
  );
}
