import type { Coupon } from "@/lib/clube/coupons";

export function PartnerPreviewCard({ coupon, onSelect }: { coupon: Coupon; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-4 rounded-card border border-teal-ink/10 bg-white p-4 text-left shadow-sm shadow-teal-ink/5 transition-colors hover:border-turquoise/60"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-sand text-3xl" aria-hidden>
        {coupon.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-bold text-teal-ink">{coupon.name}</p>
        <p className="truncate text-xs text-teal-ink/60">📍 {coupon.neighborhood}</p>
        <span className="mt-1 inline-block rounded-pill bg-coral/12 px-2 py-0.5 text-[11px] font-bold text-coral-deep">
          🎁 {coupon.offer}
        </span>
      </div>
      <span className="shrink-0 text-xs font-bold text-turquoise-deep">Desbloquear →</span>
    </button>
  );
}
