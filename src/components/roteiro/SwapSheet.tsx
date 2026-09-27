"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getPlaceImage } from "@/lib/itinerary/placeImages";
import type { Place } from "@/lib/supabase/types";

const INITIAL_OPTIONS = 3;

export function SwapSheet({
  activityName,
  categoryLabel,
  options,
  partnerIds,
  onSelect,
  onClose,
}: {
  activityName: string;
  categoryLabel: string | null;
  options: Place[];
  partnerIds: Set<string>;
  onSelect: (place: Place) => void;
  onClose: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? options : options.slice(0, INITIAL_OPTIONS);
  const hiddenCount = options.length - visible.length;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Trocar ${activityName}`}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-graphite p-5 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-turquoise">⇄ Trocar programa</p>
            <h2 className="mt-0.5 truncate font-display text-lg font-extrabold text-ink">{activityName}</h2>
            <p className="text-xs text-ink-dim">
              {categoryLabel ? `Outras opções de ${categoryLabel}` : "Sugestões dos nossos parceiros"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="shrink-0 text-lg text-ink-dim hover:text-ink"
          >
            ✕
          </button>
        </div>

        {options.length === 0 ? (
          <p className="mt-4 text-sm text-ink-dim">Nenhuma outra opção disponível no momento.</p>
        ) : (
          <div className="-mx-1 mt-4 flex flex-col gap-2 overflow-y-auto px-1 pb-1">
            {visible.map((place) => {
              const isPartner = partnerIds.has(place.id);
              return (
                <button
                  key={place.id}
                  type="button"
                  aria-label={`Escolher ${place.name}`}
                  onClick={() => onSelect(place)}
                  className={`flex items-center gap-3 rounded-card border p-2.5 text-left transition-colors hover:border-turquoise/60 ${
                    isPartner ? "border-coral/40 bg-coral/10" : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/20">
                    <Image
                      src={getPlaceImage(place.name, place.photos[0])}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate font-display text-sm font-bold text-ink">{place.name}</span>
                      {isPartner && (
                        <span className="shrink-0 rounded-pill bg-coral px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none text-graphite">
                          Parceiro
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-ink-dim">
                      {place.category} · {place.neighborhood}
                      {typeof place.rating === "number" && ` · ⭐ ${place.rating.toFixed(1)}`}
                    </p>
                    {place.partner_offer && (
                      <p className="mt-0.5 truncate text-[11px] font-bold text-coral">🏷️ {place.partner_offer}</p>
                    )}
                  </div>
                  <span aria-hidden className="shrink-0 text-turquoise">
                    ⇄
                  </span>
                </button>
              );
            })}

            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-pill border border-dashed border-white/20 py-2 text-xs font-bold text-ink-dim transition-colors hover:border-turquoise/50 hover:text-turquoise"
              >
                <span className="text-base leading-none">+</span> Mais opções ({hiddenCount})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
