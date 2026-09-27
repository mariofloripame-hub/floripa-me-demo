"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CheckResult } from "@/lib/cortesia/checkCode";

type Phase =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "checked"; code: string; result: CheckResult; message: string }
  | { kind: "confirmed"; offerText: string };

const LOGIN_PATH = `/parceiro/entrar?next=${encodeURIComponent("/parceiro/validar")}`;

export function ValidateCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function post(path: string, value: string) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value }),
    });
    if (response.status === 401) {
      router.push(LOGIN_PATH);
      return null;
    }
    return { status: response.status, body: await response.json() };
  }

  async function handleCheck(event: FormEvent) {
    event.preventDefault();
    setPhase({ kind: "busy" });
    const answer = await post("/api/parceiro/validar", code);
    if (!answer) return;
    setPhase({ kind: "checked", code, result: answer.body.result, message: answer.body.message });
  }

  async function handleConfirm(checkedCode: string) {
    setPhase({ kind: "busy" });
    const answer = await post("/api/parceiro/confirmar", checkedCode);
    if (!answer) return;
    if (answer.status === 200) {
      setPhase({ kind: "confirmed", offerText: answer.body.offerText });
      return;
    }
    setPhase({ kind: "checked", code: checkedCode, result: answer.body.result, message: answer.body.message });
  }

  function reset() {
    setCode("");
    setPhase({ kind: "idle" });
  }

  if (phase.kind === "confirmed") {
    return (
      <section className="flex flex-col items-center gap-3 rounded-card border border-turquoise/30 bg-white p-6 text-center">
        <p className="text-4xl" aria-hidden>
          🎉
        </p>
        <p className="font-display text-lg font-extrabold">Cortesia entregue!</p>
        <p className="text-sm text-teal-ink/70">
          {phase.offerText} — a visita foi registrada no seu painel.
        </p>
        <button type="button" onClick={reset} className="rounded-pill bg-teal-ink px-5 py-2 text-sm font-bold text-sand">
          Validar outro código
        </button>
      </section>
    );
  }

  const checked = phase.kind === "checked" ? phase : null;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-teal-ink/10 bg-white p-5">
      <form onSubmit={handleCheck} className="flex flex-col gap-3">
        <label htmlFor="codigo" className="text-sm font-bold">
          Código do cliente
        </label>
        <input
          id="codigo"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="FMY-4K7P"
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full rounded-card border border-teal-ink/15 px-4 py-4 text-center font-display text-3xl font-extrabold tracking-[0.2em] placeholder:text-teal-ink/20"
        />
        <button
          type="submit"
          disabled={!code.trim() || phase.kind === "busy"}
          className="rounded-pill bg-teal-ink px-5 py-3 text-sm font-bold text-sand disabled:opacity-40"
        >
          Verificar código
        </button>
      </form>

      {checked && checked.result.status === "valid" && (
        <div className="flex flex-col gap-3 rounded-card bg-turquoise/10 p-4">
          <p className="text-sm">
            ✅ Código válido: <strong>{checked.result.offerText}</strong>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="flex-1 rounded-pill bg-white py-2 text-sm font-bold text-teal-ink/60">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleConfirm(checked.code)}
              className="flex-1 rounded-pill bg-turquoise-deep py-2 text-sm font-bold text-white"
            >
              Confirmar entrega
            </button>
          </div>
        </div>
      )}

      {checked && checked.result.status !== "valid" && (
        <p className="rounded-card bg-coral/10 p-4 text-sm text-coral-deep">{checked.message}</p>
      )}
    </section>
  );
}
