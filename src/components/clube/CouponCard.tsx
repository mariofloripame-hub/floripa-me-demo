import type { Coupon } from "@/lib/clube/coupons";

export function CouponCard({
  coupon,
  redeemed,
  limitReached,
  onRedeem,
}: {
  coupon: Coupon;
  redeemed: boolean;
  limitReached: boolean;
  onRedeem: (couponId: string) => void;
}) {
  const disabled = redeemed || limitReached;

  return (
    <div className="flex items-center gap-3 rounded-card border border-white/10 bg-white/5 p-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xl" aria-hidden>
        {coupon.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold text-ink">{coupon.name}</p>
        <p className="truncate text-xs text-ink-dim">📍 {coupon.neighborhood}</p>
        <span className="mt-1 inline-block rounded-pill bg-coral/15 px-2 py-0.5 text-[10px] font-bold text-coral">
          🎁 {coupon.offer}
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRedeem(coupon.id)}
        className={`shrink-0 rounded-pill px-3 py-2 text-xs font-bold ${
          redeemed
            ? "bg-turquoise/20 text-turquoise"
            : limitReached
              ? "cursor-not-allowed bg-white/10 text-ink-dim"
              : "bg-ink text-graphite hover:bg-ink/80"
        }`}
      >
        {redeemed ? "✓ Resgatado" : limitReached ? "Limite atingido" : "+ Resgatar"}
      </button>
    </div>
  );
}
