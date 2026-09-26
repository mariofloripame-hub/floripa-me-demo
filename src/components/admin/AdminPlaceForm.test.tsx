import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AdminPlaceForm } from "./AdminPlaceForm";
import type { Place } from "@/lib/supabase/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

class FakeFormData {
  entriesList: [string, unknown][] = [];
  append(key: string, value: unknown) {
    this.entriesList.push([key, value]);
  }
  get(key: string) {
    return this.entriesList.find(([k]) => k === key)?.[1];
  }
}

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "p1", region: "Sul", neighborhood: "Campeche", name: "JJR Surfe Coach", category: "Esporte",
    target_profiles: [], price_range: "R$", point_type: "Aula de Surf", short_description: "Aulas de surf.",
    address: "Servidão A", opening_hours: "Seg a Seg", phone: "(48) 99828-2601", instagram: "@surfcoachjjr",
    notes: null, google_place_id: null, lat: null, lng: null, rating: null,
    photos: ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg"],
    is_partner: true, partner_plan: "Mensal", partner_offer: null, partner_status: "cortesia",
    special_needs_tags: [], is_verified: false, created_at: "2026-01-01T00:00:00Z",
    contact_name: null, contact_email: null, contact_phone: null, submission_source: "self_signup",
    ...overrides,
  };
}

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("FormData", FakeFormData);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPlaceForm (create mode)", () => {
  it("does not submit when required fields are empty", async () => {
    render(<AdminPlaceForm mode="create" />);
    fireEvent.click(screen.getByRole("button", { name: /criar estabelecimento/i }));
    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });

  it("posts a multipart request and redirects to the new place's edit page on success", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ id: "new-1" }) } as Response);
    render(<AdminPlaceForm mode="create" />);
    fireEvent.change(screen.getByPlaceholderText("Nome do estabelecimento"), { target: { value: "Novo Bar" } });
    fireEvent.change(screen.getByPlaceholderText(/tipo \(ex/i), { target: { value: "Bar" } });
    fireEvent.change(screen.getByPlaceholderText("Descrição"), {
      target: { value: "Um bar bem legal na beira da praia." },
    });
    fireEvent.change(screen.getByPlaceholderText("Bairro"), { target: { value: "Campeche" } });
    fireEvent.change(screen.getByPlaceholderText("Endereço completo"), { target: { value: "Rua X" } });
    fireEvent.change(screen.getByPlaceholderText("Telefone"), { target: { value: "(48) 90000-0000" } });
    fireEvent.change(screen.getByPlaceholderText(/ex: seg a sáb/i), { target: { value: "Todo dia" } });
    fireEvent.click(screen.getByRole("button", { name: /criar estabelecimento/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/estabelecimentos/new-1"));
    expect(fetch).toHaveBeenCalledWith("/api/admin/places", expect.objectContaining({ method: "POST" }));
  });
});

describe("AdminPlaceForm (edit mode)", () => {
  it("prefills fields from the given place", () => {
    render(<AdminPlaceForm mode="edit" place={place()} />);
    expect(screen.getByPlaceholderText("Nome do estabelecimento")).toHaveValue("JJR Surfe Coach");
  });

  it("shows the partner sub-fields only while is_partner is checked", () => {
    render(<AdminPlaceForm mode="edit" place={place({ is_partner: false })} />);
    expect(screen.queryByPlaceholderText(/plano \(ex/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/é parceiro/i));
    expect(screen.getByPlaceholderText(/plano \(ex/i)).toBeInTheDocument();
  });

  it("removing an existing photo excludes it from the save payload", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    render(<AdminPlaceForm mode="edit" place={place()} />);
    fireEvent.click(screen.getAllByLabelText(/remover foto/i)[0]);
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/places/p1", expect.objectContaining({ method: "PATCH" })),
    );
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body.photos).toEqual(["https://cdn.test/b.jpg"]);
  });

  it("selecting a new photo file uploads it immediately to the place's photos endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ photos: ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg", "https://cdn.test/c.jpg"] }),
    } as Response);
    render(<AdminPlaceForm mode="edit" place={place()} />);
    const file = new File([new Uint8Array(10)], "c.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/places/p1/photos", expect.objectContaining({ method: "POST" })),
    );
  });
});
