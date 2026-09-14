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
    <div className="flex items-center gap-3 rounded-card border border-teal-ink/10 bg-white p-3 shadow-sm shadow-teal-ink/5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sand text-xl" aria-hidden>
        {coupon.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold text-teal-ink">{coupon.name}</p>
        <p className="truncate text-xs text-teal-ink/60">📍 {coupon.neighborhood}</p>
        <span className="mt-1 inline-block rounded-pill bg-coral/12 px-2 py-0.5 text-[10px] font-bold text-coral-deep">
          🎁 {coupon.offer}
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRedeem(coupon.id)}
        className={`shrink-0 rounded-pill px-3 py-2 text-xs font-bold ${
          redeemed
            ? "bg-turquoise/15 text-turquoise-deep"
            : limitReached
              ? "cursor-not-allowed bg-teal-ink/8 text-teal-ink/40"
              : "bg-teal-ink text-sand hover:bg-teal-ink/85"
        }`}
      >
        {redeemed ? "✓ Resgatado" : limitReached ? "Limite atingido" : "+ Resgatar"}
      </button>
    </div>
  );
}
