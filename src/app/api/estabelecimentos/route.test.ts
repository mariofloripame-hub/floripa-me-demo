import { describe, it, expect, vi } from "vitest";

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
  it("returns 201 on a successful submission", async () => {
    vi.mocked(submitEstablishment).mockResolvedValue({ skipped: false });
    const response = await POST(formRequest(FIELDS));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
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
