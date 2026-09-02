"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ProgressBar } from "@/components/quiz/ProgressBar";
import { PlanCard } from "@/components/clube/PlanCard";
import { CouponCard } from "@/components/clube/CouponCard";
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

function PlansStep({ onSelectPlan }: { onSelectPlan: (planId: ClubePlanId) => void }) {
  return (
    <div className="flex flex-col gap-6 p-4">
      <Link
        href="/"
        aria-label="Voltar"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-ink"
      >
        ←
      </Link>
      <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-blue/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue">
        ⭐ Para quem mora em Floripa
      </span>
      <h1 className="font-display text-3xl font-extrabold text-ink">
        Vantagens reais, todo <span className="text-turquoise">mês.</span>
      </h1>
      <p className="text-sm text-ink-dim">
        Assine o Clube Local e escolha seus cupons em restaurantes, passeios e lojas parceiras — descontos que se
        pagam na primeira visita.
      </p>
      <div className="flex gap-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onSelect={onSelectPlan} />
        ))}
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
      <button
        type="button"
        onClick={onBack}
        className="w-fit text-xs text-ink-dim underline decoration-ink-dim/40 underline-offset-4 transition hover:text-turquoise"
      >
        ← Voltar
      </button>
      <h1 className="font-display text-2xl font-extrabold text-ink">Quase lá!</h1>
      <p className="text-sm text-ink-dim">
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
          className="rounded-pill border border-white/10 bg-graphite px-4 py-3 text-sm text-ink placeholder:text-ink-dim"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
          required
          aria-label="E-mail"
          className="rounded-pill border border-white/10 bg-graphite px-4 py-3 text-sm text-ink placeholder:text-ink-dim"
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
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold text-ink-dim">
            {subscription.redeemedCouponIds.length}/{plan.couponsPerMonth} cupons usados este mês
          </p>
          <ProgressBar current={subscription.redeemedCouponIds.length} total={plan.couponsPerMonth} />
        </div>
        <button
          type="button"
          onClick={onExit}
          className="ml-3 shrink-0 text-xs text-ink-dim underline decoration-ink-dim/40 underline-offset-4 transition hover:text-turquoise"
        >
          Sair do clube
        </button>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-turquoise">📍 Escolha a região</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setRegion(null)}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-card border px-4 py-3 text-xs font-bold ${
              region === null ? "border-turquoise bg-turquoise/10 text-turquoise" : "border-white/10 bg-white/5 text-ink-dim"
            }`}
          >
            <span aria-hidden>🏝️</span>
            <span>Todas</span>
            <span className="text-[10px] font-medium text-ink-dim">{COUPONS.length}</span>
          </button>
          {regionOptions(COUPONS).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRegion(opt.value)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-card border px-4 py-3 text-xs font-bold ${
                region === opt.value ? "border-turquoise bg-turquoise/10 text-turquoise" : "border-white/10 bg-white/5 text-ink-dim"
              }`}
            >
              <span aria-hidden>{opt.icon}</span>
              <span>{opt.label}</span>
              <span className="text-[10px] font-medium text-ink-dim">{opt.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`shrink-0 rounded-pill px-4 py-2 text-xs font-bold ${
            category === null ? "bg-ink text-graphite" : "bg-white/10 text-ink-dim"
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
              category === opt.value ? "bg-ink text-graphite" : "bg-white/10 text-ink-dim"
            }`}
          >
            <span aria-hidden>{opt.icon}</span> <span>{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="rounded-card border border-white/10 bg-white/5 p-6 text-center text-sm text-ink-dim">
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
        <div className="rounded-card border border-turquoise/30 bg-turquoise/5 p-4 text-center">
          <p className="text-sm font-bold text-ink">Quer mais cupons?</p>
          <p className="mt-1 text-xs text-ink-dim">Assine o Local+ e resgate até {localPlusPlan.couponsPerMonth} por mês.</p>
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
    <main className="min-h-dvh bg-graphite text-ink">
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
