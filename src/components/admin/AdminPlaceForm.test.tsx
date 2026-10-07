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

  it("keeps a legacy region/category value (predating the fixed option lists) selected and round-trips it unchanged on save", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    render(<AdminPlaceForm mode="edit" place={place({ region: "Continente", category: "Cultura / Gastrô" })} />);
    expect(screen.getByDisplayValue("Continente")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cultura / Gastrô")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/places/p1", expect.objectContaining({ method: "PATCH" })),
    );
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(options!.body as string);
    expect(body.region).toBe("Continente");
    expect(body.category).toBe("Cultura / Gastrô");
  });

  it("shows and prefills the submitter's contact fields, so the team can reach them during review", () => {
    render(
      <AdminPlaceForm
        mode="edit"
        place={place({ contact_name: "Felipe Sperdutti", contact_email: "felipe@example.com", contact_phone: "48 98414-0800" })}
      />,
    );
    expect(screen.getByDisplayValue("Felipe Sperdutti")).toBeInTheDocument();
    expect(screen.getByDisplayValue("felipe@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("48 98414-0800")).toBeInTheDocument();
  });

  it("shows the partner sub-fields only while is_partner is checked", () => {
    render(<AdminPlaceForm mode="edit" place={place({ is_partner: false })} />);
    expect(screen.queryByPlaceholderText(/plano \(ex/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/é parceiro/i));
    expect(screen.getByPlaceholderText(/plano \(ex/i)).toBeInTheDocument();
  });

  it("renders a bare Google Places photo reference through the photo proxy, and a hosted URL as-is", () => {
    const ref = "places/ChIJabc/photos/xyz";
    const { container } = render(<AdminPlaceForm mode="edit" place={place({ photos: [ref, "https://cdn.test/a.jpg"] })} />);
    const srcs = Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"));
    expect(srcs).toEqual([`/api/place-photo?ref=${encodeURIComponent(ref)}`, "https://cdn.test/a.jpg"]);
  });

  it("offers a visible Adicionar fotos button wired to the file input", () => {
    render(<AdminPlaceForm mode="edit" place={place()} />);
    const input = screen.getByLabelText(/adicionar fotos/i);
    expect(input).toHaveAttribute("type", "file");
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

describe("AdminPlaceForm (lodging booking fields)", () => {
  it("prefills the reservations WhatsApp from the phone when switching to Hospedagem", () => {
    render(<AdminPlaceForm mode="create" />);
    fireEvent.change(screen.getByPlaceholderText("Telefone"), { target: { value: "(48) 90000-0000" } });
    fireEvent.change(screen.getByDisplayValue("Praia"), { target: { value: "Hospedagem" } });
    expect(screen.getByLabelText("WhatsApp para reservas")).toHaveValue("(48) 90000-0000");
  });

  it("keeps a deliberately empty reservations WhatsApp when editing an existing lodging", () => {
    render(<AdminPlaceForm mode="edit" place={place({ category: "Hospedagem", booking_whatsapp: null, booking_url: "https://pousada.com" })} />);
    expect(screen.getByLabelText("WhatsApp para reservas")).toHaveValue("");
  });
});

describe("AdminPlaceForm (cover photo)", () => {
  it("marks the first photo as the cover", () => {
    render(<AdminPlaceForm mode="edit" place={place()} />);
    expect(screen.getByText("Capa")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Usar como capa" })).toHaveLength(1);
  });

  it("moves the chosen photo to the front when saving", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    render(<AdminPlaceForm mode="edit" place={place()} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar como capa" }));
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/places/p1", expect.objectContaining({ method: "PATCH" })),
    );
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(options!.body as string).photos).toEqual(["https://cdn.test/b.jpg", "https://cdn.test/a.jpg"]);
  });
});

describe("AdminPlaceForm (lodging highlights)", () => {
  const lodging = (highlights: string[]) => place({ category: "Hospedagem", highlights, booking_whatsapp: "48999990000" });

  it("ticks the saved highlights", () => {
    render(<AdminPlaceForm mode="edit" place={lodging(["🌊 Vista para o mar"])} />);
    expect(screen.getByLabelText("🌊 Vista para o mar")).toBeChecked();
    expect(screen.getByLabelText("🏊 Piscina")).not.toBeChecked();
  });

  it("disables the other options once 3 are ticked", () => {
    render(<AdminPlaceForm mode="edit" place={lodging(["🌊 Vista para o mar", "🏊 Piscina"])} />);
    expect(screen.getByLabelText("💆 Spa")).toBeEnabled();
    fireEvent.click(screen.getByLabelText("🐾 Pet friendly"));
    expect(screen.getByLabelText("💆 Spa")).toBeDisabled();
    expect(screen.getByLabelText("🐾 Pet friendly")).toBeEnabled();
  });

  it("keeps a saved highlight that is not in the list", () => {
    render(<AdminPlaceForm mode="edit" place={lodging(["Rooftop"])} />);
    expect(screen.getByLabelText("Rooftop")).toBeChecked();
  });

  it("saves the ticked highlights", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    render(<AdminPlaceForm mode="edit" place={lodging([])} />);
    fireEvent.click(screen.getByLabelText("🏊 Piscina"));
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/admin/places/p1", expect.objectContaining({ method: "PATCH" })),
    );
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(options!.body as string).highlights).toEqual(["🏊 Piscina"]);
  });

  it("does not show highlights for other categories", () => {
    render(<AdminPlaceForm mode="edit" place={place()} />);
    expect(screen.queryByText(/Escolha até 3/)).toBeNull();
  });
});
