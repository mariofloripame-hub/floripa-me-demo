"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PlanCard } from "@/components/clube/PlanCard";
import { CouponCard } from "@/components/clube/CouponCard";
import { PartnerPreviewCard } from "@/components/clube/PartnerPreviewCard";
import { BrandWordmark } from "@/components/clube/BrandWordmark";
import { PLANS, COUPONS, regionOptions, categoryOptions, type ClubePlanId } from "@/lib/clube/coupons";
import {
  readSubscription,
  writeSubscription,
  redeemCoupon,
  clearSubscription,
  type ClubeSubscription,
} from "@/lib/clube/subscription";

type Step = "plans" | "signup" | "portal";

function findPlan(planId: ClubePlanId) {
  return PLANS.find((p) => p.id === planId) ?? PLANS[0];
}

const FEATURED_COUPON_IDS = ["ostradamus", "shopping-iguatemi", "studio-bem-estar-trindade"];
const featuredCoupons = COUPONS.filter((c) => FEATURED_COUPON_IDS.includes(c.id));

function PlansStep({ onSelectPlan }: { onSelectPlan: (planId: ClubePlanId) => void }) {
  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="Voltar"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-ink/10 bg-white text-teal-ink"
        >
          ←
        </Link>
        <BrandWordmark />
      </div>
      <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-turquoise/12 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-turquoise-deep">
        ⭐ Para quem mora em Floripa
      </span>
      <h1 className="font-display text-3xl font-extrabold text-teal-ink">
        Vantagens reais, todo <span className="text-turquoise-deep">mês.</span>
      </h1>
      <p className="text-sm text-teal-ink/60">
        Assine o Clube Local e escolha seus cupons em restaurantes, passeios e lojas parceiras — descontos que se
        pagam na primeira visita.
      </p>

      <div className="rounded-card border border-turquoise/25 bg-turquoise/8 p-4">
        <p className="text-sm font-bold text-teal-ink">Um jantar ou passeio já pode pagar sua mensalidade.</p>
        <p className="mt-1 text-xs text-teal-ink/60">
          Assinantes economizam mais de R$150 por mês em média nos parceiros do clube.
        </p>
      </div>

      <div className="flex gap-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onSelect={onSelectPlan} />
        ))}
      </div>
      <p className="-mt-3 text-center text-[11px] text-teal-ink/50">Sem fidelidade. Cancele quando quiser.</p>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold text-teal-ink">Cupons em destaque este mês</h2>
        {featuredCoupons.map((coupon) => (
          <PartnerPreviewCard key={coupon.id} coupon={coupon} onSelect={() => onSelectPlan("local+")} />
        ))}
        <div className="flex flex-col gap-2 rounded-card border border-teal-ink/10 bg-white p-4">
          <p className="text-sm italic text-teal-ink/80">
            &ldquo;Já economizei muito mais que a assinatura no primeiro mês, só com o desconto no Ostradamus.&rdquo;
            {" "}— Mariana, Trindade
          </p>
          <p className="text-xs font-bold text-turquoise-deep">{COUPONS.length} parceiros já no clube, por toda a Ilha</p>
        </div>
      </div>
    </div>
  );
}

function SignupStep({
  planId,
  onSubmit,
  onBack,
}: {
  planId: ClubePlanId;
  onSubmit: (input: { name: string; email: string }) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const plan = findPlan(planId);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onSubmit({ name: name.trim(), email: email.trim() });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="w-fit text-xs text-teal-ink/60 underline decoration-teal-ink/25 underline-offset-4 transition hover:text-turquoise-deep"
        >
          ← Voltar
        </button>
        <BrandWordmark />
      </div>
      <h1 className="font-display text-2xl font-extrabold text-teal-ink">Quase lá!</h1>
      <p className="text-sm text-teal-ink/60">
        Plano {plan.name} · {plan.priceLabel}/mês · {plan.description}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          required
          aria-label="Nome"
          className="rounded-pill border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
          required
          aria-label="E-mail"
          className="rounded-pill border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40"
        />
        <button
          type="submit"
          className="rounded-pill bg-gradient-to-r from-turquoise to-blue py-3 text-sm font-display font-extrabold text-graphite"
        >
          Assinar plano {plan.name} →
        </button>
      </form>
    </div>
  );
}

function RedemptionProgress({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="h-1 w-full rounded-full bg-teal-ink/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-turquoise to-blue transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PortalStep({
  subscription,
  onRedeem,
  onExit,
}: {
  subscription: ClubeSubscription;
  onRedeem: (couponId: string) => void;
  onExit: () => void;
}) {
  const [region, setRegion] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const plan = findPlan(subscription.planId);
  const limitReached = subscription.redeemedCouponIds.length >= plan.couponsPerMonth;
  const localPlusPlan = findPlan("local+");

  const filtered = COUPONS.filter(
    (c) => (!region || c.region === region) && (!category || c.category === category),
  );

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-end">
        <BrandWordmark />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold text-teal-ink/60">
            {subscription.redeemedCouponIds.length}/{plan.couponsPerMonth} cupons usados este mês
          </p>
          <div className="mt-1.5">
            <RedemptionProgress current={subscription.redeemedCouponIds.length} total={plan.couponsPerMonth} />
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="ml-3 shrink-0 text-xs text-teal-ink/60 underline decoration-teal-ink/25 underline-offset-4 transition hover:text-turquoise-deep"
        >
          Sair do clube
        </button>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-turquoise-deep">📍 Escolha a região</h2>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setRegion(null)}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-card border px-4 py-3 text-xs font-bold ${
              region === null ? "border-turquoise bg-turquoise/10 text-turquoise-deep" : "border-teal-ink/10 bg-white text-teal-ink/60"
            }`}
          >
            <span aria-hidden>🏝️</span>
            <span>Todas</span>
            <span className="text-[10px] font-medium text-teal-ink/50">{COUPONS.length}</span>
          </button>
          {regionOptions(COUPONS).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRegion(opt.value)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-card border px-4 py-3 text-xs font-bold ${
                region === opt.value ? "border-turquoise bg-turquoise/10 text-turquoise-deep" : "border-teal-ink/10 bg-white text-teal-ink/60"
              }`}
            >
              <span aria-hidden>{opt.icon}</span>
              <span>{opt.label}</span>
              <span className="text-[10px] font-medium text-teal-ink/50">{opt.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`shrink-0 rounded-pill px-4 py-2 text-xs font-bold ${
            category === null ? "bg-teal-ink text-sand" : "bg-white text-teal-ink/60"
          }`}
        >
          Tudo
        </button>
        {categoryOptions(COUPONS).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCategory(opt.value)}
            className={`shrink-0 rounded-pill px-4 py-2 text-xs font-bold ${
              category === opt.value ? "bg-teal-ink text-sand" : "bg-white text-teal-ink/60"
            }`}
          >
            <span aria-hidden>{opt.icon}</span> <span>{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="rounded-card border border-teal-ink/10 bg-white p-6 text-center text-sm text-teal-ink/60">
            Nenhum cupom nessa combinação. Tente outra região ou categoria.
          </p>
        ) : (
          filtered.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              redeemed={subscription.redeemedCouponIds.includes(coupon.id)}
              limitReached={limitReached}
              onRedeem={onRedeem}
            />
          ))
        )}
      </div>

      {subscription.planId === "local" && (
        <div className="rounded-card border border-turquoise/25 bg-turquoise/8 p-4 text-center">
          <p className="text-sm font-bold text-teal-ink">Quer mais cupons?</p>
          <p className="mt-1 text-xs text-teal-ink/60">Assine o Local+ e resgate até {localPlusPlan.couponsPerMonth} por mês.</p>
          <button
            type="button"
            onClick={onExit}
            className="mt-3 rounded-pill bg-gradient-to-r from-turquoise to-blue px-4 py-2 text-xs font-display font-extrabold text-graphite"
          >
            Assinar Local+ →
          </button>
        </div>
      )}
    </div>
  );
}

export default function ClubePage() {
  const [step, setStep] = useState<Step>("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<ClubePlanId>("local");
  const [subscription, setSubscription] = useState<ClubeSubscription | null>(null);

  useEffect(() => {
    const existing = readSubscription();
    if (existing) {
      setSubscription(existing);
      setStep("portal");
    }
  }, []);

  function handleSelectPlan(planId: ClubePlanId) {
    setSelectedPlanId(planId);
    setStep("signup");
  }

  function handleSignup({ name, email }: { name: string; email: string }) {
    const newSubscription: ClubeSubscription = { planId: selectedPlanId, name, email, redeemedCouponIds: [] };
    writeSubscription(newSubscription);
    setSubscription(newSubscription);
    setStep("portal");
  }

  function handleRedeem(couponId: string) {
    if (!subscription) return;
    const plan = findPlan(subscription.planId);
    const updated = redeemCoupon(subscription, couponId, plan.couponsPerMonth);
    if (updated === subscription) return;
    writeSubscription(updated);
    setSubscription(updated);
  }

  function handleExit() {
    clearSubscription();
    setSubscription(null);
    setStep("plans");
  }

  return (
    <main className="min-h-dvh bg-sand text-teal-ink">
      {step === "plans" && <PlansStep onSelectPlan={handleSelectPlan} />}
      {step === "signup" && (
        <SignupStep planId={selectedPlanId} onSubmit={handleSignup} onBack={() => setStep("plans")} />
      )}
      {step === "portal" && subscription && (
        <PortalStep subscription={subscription} onRedeem={handleRedeem} onExit={handleExit} />
      )}
    </main>
  );
}
