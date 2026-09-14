import type { ClubePlan, ClubePlanId } from "@/lib/clube/coupons";

export function PlanCard({ plan, onSelect }: { plan: ClubePlan; onSelect: (planId: ClubePlanId) => void }) {
  const isFeatured = plan.id === "local+";

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-card border border-teal-ink/10 bg-white px-4 py-5 text-center shadow-sm shadow-teal-ink/5">
      {isFeatured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill bg-turquoise-deep px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Mais escolhido
        </span>
      )}
      <span className="font-display text-sm font-bold text-teal-ink">{plan.name}</span>
      <span className="font-display text-lg font-extrabold text-turquoise-deep sm:text-xl">
        {plan.priceLabel}
        <span className="text-xs font-medium text-teal-ink/60">/mês</span>
      </span>
      <span className="text-xs text-teal-ink/60">{plan.description}</span>
      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        className="mt-2 w-full rounded-pill bg-gradient-to-r from-turquoise to-blue py-2 text-xs font-display font-extrabold text-graphite"
      >
        Assinar {plan.name}
      </button>
    </div>
  );
}
