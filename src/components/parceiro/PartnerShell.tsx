"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandWordmark } from "@/components/clube/BrandWordmark";

export function PartnerShell({
  placeName,
  plan,
  active,
  children,
}: {
  placeName: string;
  plan: string | null;
  active: "painel" | "validar";
  children: ReactNode;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/parceiro/logout", { method: "POST" });
    router.push("/parceiro/entrar");
  }

  const tabClass = (tab: "painel" | "validar") =>
    `rounded-pill px-4 py-2 text-sm font-bold ${active === tab ? "bg-teal-ink text-sand" : "bg-white text-teal-ink/60"}`;

  return (
    <main className="min-h-dvh bg-sand p-4 text-teal-ink sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <BrandWordmark />
            <span className="text-xs font-semibold text-teal-ink/60">Portal do Parceiro</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-pill bg-teal-ink/10 px-3 py-1 text-xs font-bold text-teal-ink"
          >
            Sair
          </button>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold">{placeName}</h1>
          {plan && (
            <span className="rounded-pill bg-coral/15 px-2.5 py-1 text-[11px] font-bold text-coral-deep">⭐ Plano {plan}</span>
          )}
        </div>
        <nav className="flex gap-2">
          <Link href="/parceiro" className={tabClass("painel")}>
            📊 Painel
          </Link>
          <Link href="/parceiro/validar" className={tabClass("validar")}>
            ✅ Validar código
          </Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
