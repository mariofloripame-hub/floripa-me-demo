"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BrandWordmark } from "@/components/clube/BrandWordmark";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError("Senha incorreta.");
        return;
      }
      router.push("/admin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-sand p-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandWordmark />
          <h1 className="font-display text-2xl font-extrabold text-teal-ink">Painel administrativo</h1>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="w-full rounded-pill border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40"
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
