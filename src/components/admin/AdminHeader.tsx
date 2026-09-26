"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandWordmark } from "@/components/clube/BrandWordmark";

export function AdminHeader({ backHref }: { backHref?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Voltar"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-ink/10 bg-white text-teal-ink"
          >
            ←
          </Link>
        )}
        <Link href="/admin" className="flex flex-col leading-tight">
          <BrandWordmark />
          <span className="text-xs font-semibold text-teal-ink/60">Painel administrativo</span>
        </Link>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-pill bg-teal-ink/10 px-3 py-1 text-xs font-bold text-teal-ink"
      >
        Sair
      </button>
    </div>
  );
}
