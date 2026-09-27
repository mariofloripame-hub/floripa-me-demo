"use client";

import { useEffect, useState } from "react";
import {
  clearCachedCode,
  getDeviceId,
  readCachedCode,
  writeCachedCode,
  type CachedCode,
} from "@/lib/cortesia/deviceStorage";
import { usedLabel, validityLabel } from "@/lib/cortesia/labels";

type SheetState = { kind: "loading" } | { kind: "ready"; code: CachedCode } | { kind: "error" };

async function requestNewCode(placeId: string, itinerarySlug: string): Promise<CachedCode | null> {
  const response = await fetch("/api/cortesia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, itinerarySlug, deviceId: getDeviceId() }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { code: string; offerText: string; expiresAt: string };
  const cached: CachedCode = { ...body, redeemedAt: null };
  writeCachedCode(placeId, cached);
  return cached;
}

export function CourtesySheet({
  placeId,
  placeName,
  itinerarySlug,
  onClose,
}: {
  placeId: string;
  placeName: string;
  itinerarySlug: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<SheetState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const show = (next: SheetState) => {
      if (!cancelled) setState(next);
    };

    async function issueFresh() {
      const fresh = await requestNewCode(placeId, itinerarySlug).catch(() => null);
      show(fresh ? { kind: "ready", code: fresh } : { kind: "error" });
    }

    async function run() {
      const cached = readCachedCode(placeId);
      if (!cached) {
        await issueFresh();
        return;
      }
      show({ kind: "ready", code: cached });
      if (cached.redeemedAt) return;
      try {
        const response = await fetch(
          `/api/cortesia/${encodeURIComponent(cached.code)}?deviceId=${encodeURIComponent(getDeviceId())}`,
        );
        if (response.status === 404) {
          clearCachedCode(placeId);
          await issueFresh();
          return;
        }
        if (!response.ok) return;
        const status = (await response.json()) as { status: string; redeemedAt?: string };
        if (status.status === "used" && status.redeemedAt) {
          const used = { ...cached, redeemedAt: status.redeemedAt };
          writeCachedCode(placeId, used);
          show({ kind: "ready", code: used });
        } else if (status.status === "expired") {
          clearCachedCode(placeId);
          await issueFresh();
        }
      } catch {
        // Offline at the venue: keep showing the cached code.
      }
    }

    setState({ kind: "loading" });
    void run();
    return () => {
      cancelled = true;
    };
  }, [placeId, itinerarySlug, attempt]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cortesia ${placeName}`}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col items-center gap-3 rounded-t-2xl bg-graphite p-6 text-center sm:rounded-2xl"
      >
        <div className="flex w-full items-start justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-coral">🎁 Cortesia Floripa.My</p>
          <button type="button" aria-label="Fechar" onClick={onClose} className="text-ink-dim hover:text-ink">
            ✕
          </button>
        </div>
        <h2 className="font-display text-lg font-extrabold text-ink">{placeName}</h2>

        {state.kind === "loading" && <p className="py-8 text-sm text-ink-dim">Gerando seu código...</p>}

        {state.kind === "error" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm text-ink-dim">
              Não foi possível gerar seu código. Verifique sua conexão e tente de novo.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-pill bg-turquoise px-4 py-2 text-sm font-bold text-graphite"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <p className="text-sm text-ink">{state.code.offerText}</p>
            <div
              className={`w-full rounded-card border-2 border-dashed py-5 font-display text-4xl font-extrabold tracking-[0.2em] ${
                state.code.redeemedAt ? "border-white/15 text-ink-dim line-through" : "border-coral text-ink"
              }`}
            >
              {state.code.code}
            </div>
            {state.code.redeemedAt ? (
              <p className="text-sm font-bold text-turquoise">{usedLabel(state.code.redeemedAt)}</p>
            ) : (
              <>
                <p className="text-sm font-bold text-ink">Mostre este código no balcão</p>
                <p className="text-xs text-ink-dim">
                  {validityLabel(state.code.expiresAt, new Date())} · uso único
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
