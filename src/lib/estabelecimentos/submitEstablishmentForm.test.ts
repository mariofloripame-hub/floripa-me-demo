import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitEstablishmentForm, EstablishmentSubmissionError } from "./submitEstablishmentForm";
import type { EstablishmentFields } from "./schema";

const VALUES: EstablishmentFields = {
  name: "Bar do Zé", category: "Bar / Noturno", point_type: "Bar",
  short_description: "Bar de esquina com música ao vivo às sextas.",
  region: "Sul", neighborhood: "Campeche", address: "Rua das Gaivotas, 123",
  price_range: "R$$", opening_hours: "Ter a Dom, 18h às 0h", phone: "(48) 99999-0000",
  instagram: "@bardoze", contact_name: "José Silva", contact_email: "jose@example.com",
  contact_phone: "(48) 99999-0001",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("submitEstablishmentForm", () => {
  it("posts a FormData body to /api/estabelecimentos and resolves on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await submitEstablishmentForm(VALUES, [], "");

    expect(fetchMock).toHaveBeenCalledWith("/api/estabelecimentos", expect.objectContaining({ method: "POST" }));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("name")).toBe("Bar do Zé");
    expect(body.get("website")).toBe("");
  });

  it("throws EstablishmentSubmissionError with fieldErrors on a 400 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Dados inválidos", fieldErrors: { name: "Campo obrigatório" } }),
      }),
    );

    await expect(submitEstablishmentForm(VALUES, [], "")).rejects.toMatchObject({
      message: "Dados inválidos",
      fieldErrors: { name: "Campo obrigatório" },
    });
  });

  it("throws a generic error message on a 502 response with no body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new Error("no body"); } }));

    await expect(submitEstablishmentForm(VALUES, [], "")).rejects.toBeInstanceOf(EstablishmentSubmissionError);
  });
});
