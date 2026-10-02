"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CheckResult } from "@/lib/cortesia/checkCode";
import { CODE_BODY_LENGTH, CODE_PREFIX, toCodeBody } from "@/lib/cortesia/code";

type Phase =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "checked"; code: string; result: CheckResult; message: string; notice?: string }
  | { kind: "error"; message: string }
  | { kind: "confirmed"; offerText: string };

type Answer = { status: number; body: { result: CheckResult; message: string; offerText?: string } };

const LOGIN_PATH = `/parceiro/entrar?next=${encodeURIComponent("/parceiro/validar")}`;
const FAILURE_TEXT = "Sem conexão ou erro no servidor. Tente de novo.";

export function ValidateCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // "failed" covers a dropped connection or a server error — the counter can retry.
  async function post(path: string, value: string): Promise<Answer | "login" | "failed"> {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      if (response.status === 401) {
        router.push(LOGIN_PATH);
        return "login";
      }
      if (response.status >= 500) return "failed";
      return { status: response.status, body: await response.json() };
    } catch {
      return "failed";
    }
  }

  async function handleCheck(event: FormEvent) {
    event.preventDefault();
    setPhase({ kind: "busy" });
    const fullCode = `${CODE_PREFIX}${code}`;
    const answer = await post("/api/parceiro/validar", fullCode);
    if (answer === "login") return;
    if (answer === "failed") {
      setPhase({ kind: "error", message: FAILURE_TEXT });
      return;
    }
    setPhase({ kind: "checked", code: fullCode, result: answer.body.result, message: answer.body.message });
  }

  async function handleConfirm(checked: Extract<Phase, { kind: "checked" }>) {
    setPhase({ kind: "busy" });
    const answer = await post("/api/parceiro/confirmar", checked.code);
    if (answer === "login") return;
    if (answer === "failed") {
      setPhase({ ...checked, notice: FAILURE_TEXT });
      return;
    }
    if (answer.status === 200) {
      setPhase({ kind: "confirmed", offerText: answer.body.offerText ?? "" });
      return;
    }
    const { result, message } = answer.body;
    setPhase({
      kind: "checked",
      code: checked.code,
      result,
      message,
      notice: result.status === "valid" ? message : undefined,
    });
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
        <div className="flex items-center justify-center rounded-card border border-teal-ink/15 px-3 py-4 font-mono text-3xl font-bold tracking-[0.15em] focus-within:border-teal-ink/40">
          <span className="text-teal-ink/40" aria-hidden>
            {CODE_PREFIX}
          </span>
          <input
            id="codigo"
            value={code}
            onChange={(e) => setCode(toCodeBody(e.target.value))}
            placeholder="4K7P"
            autoComplete="off"
            autoCapitalize="characters"
            className="w-[5ch] bg-transparent tracking-[0.15em] outline-none placeholder:text-teal-ink/20"
          />
        </div>
        <button
          type="submit"
          disabled={code.length < CODE_BODY_LENGTH || phase.kind === "busy"}
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
              onClick={() => handleConfirm(checked)}
              className="flex-1 rounded-pill bg-turquoise-deep py-2 text-sm font-bold text-white"
            >
              Confirmar entrega
            </button>
          </div>
          {checked.notice && <p className="text-sm text-coral-deep">{checked.notice}</p>}
        </div>
      )}

      {phase.kind === "error" && <p className="rounded-card bg-coral/10 p-4 text-sm text-coral-deep">{phase.message}</p>}

      {checked && checked.result.status !== "valid" && (
        <p className="rounded-card bg-coral/10 p-4 text-sm text-coral-deep">{checked.message}</p>
      )}
    </section>
  );
}
