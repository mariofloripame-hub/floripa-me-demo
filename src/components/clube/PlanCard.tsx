import type { ClubePlan, ClubePlanId } from "@/lib/clube/coupons";

export function PlanCard({ plan, onSelect }: { plan: ClubePlan; onSelect: (planId: ClubePlanId) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className="flex flex-1 flex-col items-center gap-1 rounded-card border border-white/15 bg-white/5 px-4 py-5 text-center transition-colors hover:border-turquoise/60"
    >
      <span className="font-display text-sm font-bold text-ink">{plan.name}</span>
      <span className="font-display text-2xl font-extrabold text-turquoise">
        {plan.priceLabel}
        <span className="text-xs font-medium text-ink-dim">/mês</span>
      </span>
      <span className="text-xs text-ink-dim">{plan.description}</span>
    </button>
  );
}
