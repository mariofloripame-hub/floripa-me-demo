"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

type Phase = "idle" | "sending" | "sent" | "invalid";

export function PartnerLoginForm({
  next,
  linkError,
  whatsapp,
}: {
  next: string;
  linkError: boolean;
  whatsapp?: string;
}) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPhase("sending");
    const response = await fetch("/api/parceiro/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next }),
    }).catch(() => null);
    setPhase(response?.status === 400 ? "invalid" : "sent");
  }

  if (phase === "sent") {
    return (
      <div className="my-auto flex w-full max-w-sm flex-col gap-3 text-center">
        <p className="text-4xl" aria-hidden>
          📬
        </p>
        <h1 className="font-display text-xl font-extrabold text-teal-ink">Enviamos um link de acesso para seu e-mail.</h1>
        <p className="text-sm text-teal-ink/60">Abra o e-mail neste aparelho para entrar.</p>
        <p className="text-sm text-teal-ink/60">
          Não recebeu? Confira a caixa de spam
          {whatsapp && (
            <>
              {" "}ou{" "}
              <a href={`https://wa.me/${whatsapp}`} className="font-bold text-turquoise-deep underline">
                fale com a gente no WhatsApp
              </a>
            </>
          )}
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="my-auto flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-center font-display text-2xl font-extrabold text-teal-ink">Portal do Parceiro</h1>
      <p className="text-center text-sm text-teal-ink/60">Digite o e-mail cadastrado do seu estabelecimento.</p>
      {linkError && (
        <p className="rounded-card bg-coral/10 p-3 text-center text-sm text-coral-deep">
          Esse link expirou ou já foi usado. Peça um novo abaixo.
        </p>
      )}
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        className="w-full rounded-pill border border-teal-ink/15 bg-white px-4 py-3 text-sm text-teal-ink placeholder:text-teal-ink/40"
      />
      {phase === "invalid" && <p className="text-sm text-coral">Confira o e-mail digitado.</p>}
      <Button type="submit" size="sm" disabled={phase === "sending"} className="self-center">
        {phase === "sending" ? "Enviando..." : "Receber link de acesso"}
      </Button>
    </form>
  );
}
