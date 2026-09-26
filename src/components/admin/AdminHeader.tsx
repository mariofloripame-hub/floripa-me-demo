"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function AdminHeader() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="flex items-center justify-between">
      <Link href="/admin" className="font-display text-lg font-extrabold text-teal-ink">
        Painel administrativo
      </Link>
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
