// @vitest-environment node
//
// jsdom's FormData/File implementation rejects a real File appended to a
// FormData (a webidl brand-check mismatch between jsdom's internal File
// class and the global File this test constructs) — a test-environment
// limitation, not a production bug: the route runs under Node at runtime
// (where this round-trips correctly, as does a real browser for the form
// page). Running this file under Node's own Request/FormData/File avoids
// the mismatch and matches what actually executes in production.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/estabelecimentos/submitEstablishment", async () => {
  const actual = await vi.importActual<typeof import("@/lib/estabelecimentos/submitEstablishment")>(
    "@/lib/estabelecimentos/submitEstablishment",
  );
  return { ...actual, submitEstablishment: vi.fn() };
});

import { POST } from "./route";
import { submitEstablishment, InvalidFieldsError, InvalidPhotosError } from "@/lib/estabelecimentos/submitEstablishment";

function formRequest(fields: Record<string, string>, photos: File[] = [], honeypot = "") {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  formData.append("website", honeypot);
  for (const photo of photos) formData.append("photos", photo);
  return new Request("http://localhost/api/estabelecimentos", { method: "POST", body: formData }) as never;
}

const FIELDS = {
  name: "Bar do Zé", category: "Bar / Noturno", point_type: "Bar",
  short_description: "Bar de esquina com música ao vivo às sextas.",
  region: "Sul", neighborhood: "Campeche", address: "Rua das Gaivotas, 123",
  price_range: "R$$", opening_hours: "Ter a Dom, 18h às 0h", phone: "(48) 99999-0000",
  instagram: "@bardoze", contact_name: "José Silva", contact_email: "jose@example.com",
  contact_phone: "(48) 99999-0001",
};

describe("POST /api/estabelecimentos", () => {
  beforeEach(() => {
    vi.mocked(submitEstablishment).mockReset();
  });

  it("returns 201 on a successful submission", async () => {
    vi.mocked(submitEstablishment).mockResolvedValue({ skipped: false });
    const response = await POST(formRequest(FIELDS));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("extracts fields (excluding the honeypot), the honeypot value, and photo files correctly", async () => {
    vi.mocked(submitEstablishment).mockResolvedValue({ skipped: false });
    const file = new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" });
    await POST(formRequest(FIELDS, [file], "bot-value"));

    expect(submitEstablishment).toHaveBeenCalledTimes(1);
    const [input] = vi.mocked(submitEstablishment).mock.calls[0];
    expect(input.fields).toEqual(FIELDS);
    expect(input.honeypot).toBe("bot-value");
    expect(input.photos).toHaveLength(1);
    expect(input.photos[0]).toBeInstanceOf(File);
    expect(input.photos[0].name).toBe("a.jpg");
    expect(input.photos[0].type).toBe("image/jpeg");
  });

  it("returns 400 without calling submitEstablishment when the body isn't parseable as form data", async () => {
    const badRequest = new Request("http://localhost/api/estabelecimentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ not: "multipart" }),
    }) as never;

    const response = await POST(badRequest);
    expect(response.status).toBe(400);
    expect(submitEstablishment).not.toHaveBeenCalled();
  });

  it("returns 413 without calling submitEstablishment when Content-Length exceeds the maximum allowed payload", async () => {
    const oversized = new Request("http://localhost/api/estabelecimentos", {
      method: "POST",
      headers: { "content-length": String(100 * 1024 * 1024) },
      body: new FormData(),
    }) as never;

    const response = await POST(oversized);
    expect(response.status).toBe(413);
    expect(submitEstablishment).not.toHaveBeenCalled();
  });

  it("returns 201 even when the submission was silently skipped as spam", async () => {
    vi.mocked(submitEstablishment).mockResolvedValue({ skipped: true });
    const response = await POST(formRequest(FIELDS, [], "bot-value"));
    expect(response.status).toBe(201);
  });

  it("returns 400 with field errors when validation fails", async () => {
    vi.mocked(submitEstablishment).mockRejectedValue(new InvalidFieldsError({ name: "Campo obrigatório" }));
    const response = await POST(formRequest(FIELDS));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Dados inválidos", fieldErrors: { name: "Campo obrigatório" } });
  });

  it("returns 400 when photos are invalid", async () => {
    vi.mocked(submitEstablishment).mockRejectedValue(new InvalidPhotosError("Cada foto deve ter no máximo 5MB."));
    const response = await POST(formRequest(FIELDS));
    expect(response.status).toBe(400);
  });

  it("returns 502 on an unexpected failure", async () => {
    vi.mocked(submitEstablishment).mockRejectedValue(new Error("boom"));
    const response = await POST(formRequest(FIELDS));
    expect(response.status).toBe(502);
  });
});
