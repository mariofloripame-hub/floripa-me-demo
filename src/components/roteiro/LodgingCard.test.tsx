import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LodgingCard } from "./LodgingCard";
import { makePlace } from "@/lib/hospedagem/fixtures";

// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <img alt={props.alt} /> }));

const featured = makePlace({ id: "11111111-1111-4111-8111-111111111111", name: "Pousada Sol", partner_offer: "10% off reservando pelo Floripa.My" });
const alt = makePlace({ id: "22222222-2222-4222-8222-222222222222", name: "Hotel Mar", booking_whatsapp: null, booking_url: "https://hotelmar.com" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T12:00:00-03:00"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function whatsappButton() {
  return screen.getByRole("link", { name: "Consultar disponibilidade" });
}

describe("LodgingCard", () => {
  it("shows the featured lodging with badge and offer", () => {
    render(<LodgingCard slug="abc" options={[featured, alt]} group="casal" />);
    expect(screen.getByText(/Onde ficar/)).toBeInTheDocument();
    expect(screen.getByText("Pousada Sol")).toBeInTheDocument();
    expect(screen.getByText("Indicado pelo Floripa.My")).toBeInTheDocument();
    expect(screen.getByText(/10% off reservando pelo Floripa.My/)).toBeInTheDocument();
  });

  it("opens WhatsApp with dates and guests from the group", () => {
    render(<LodgingCard slug="abc" options={[featured]} group="casal" />);
    fireEvent.change(screen.getByLabelText("Entrada"), { target: { value: "2027-01-12" } });
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "2027-01-15" } });
    expect(decodeURIComponent(whatsappButton().getAttribute("href")!)).toContain("de 12/01 a 15/01 para 2 pessoas?");
  });

  it("records the lead when the button is tapped", () => {
    render(<LodgingCard slug="abc" options={[featured]} group="solo" />);
    fireEvent.click(whatsappButton());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/lodging-leads");
    expect(init?.keepalive).toBe(true);
    expect(JSON.parse(init?.body as string)).toEqual({
      slug: "abc", place_id: featured.id, channel: "whatsapp", check_in: null, check_out: null, guests: 1,
    });
  });

  it("blocks the buttons while only one date is filled", () => {
    render(<LodgingCard slug="abc" options={[featured]} />);
    fireEvent.change(screen.getByLabelText("Entrada"), { target: { value: "2027-01-12" } });
    expect(screen.getByText("Preencha a data de saída")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Consultar disponibilidade" })).toBeNull();
    expect(screen.getByRole("button", { name: "Consultar disponibilidade" })).toBeDisabled();
  });

  it("blocks a check-out on the check-in day", () => {
    render(<LodgingCard slug="abc" options={[featured]} />);
    fireEvent.change(screen.getByLabelText("Entrada"), { target: { value: "2027-01-12" } });
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "2027-01-12" } });
    expect(screen.getByText("A saída precisa ser depois da entrada")).toBeInTheDocument();
  });

  it("limits the check-in to today in São Paulo", () => {
    render(<LodgingCard slug="abc" options={[featured]} />);
    expect(screen.getByLabelText("Entrada")).toHaveAttribute("min", "2026-10-06");
  });

  it("swaps to an alternative, using the site link when there is no WhatsApp", () => {
    render(<LodgingCard slug="abc" options={[featured, alt]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver mais opções de hospedagem" }));
    fireEvent.click(screen.getByRole("button", { name: /Hotel Mar/ }));
    expect(screen.getByRole("link", { name: "Reservar pelo site" })).toHaveAttribute("href", "https://hotelmar.com");
    expect(screen.queryByRole("link", { name: "Consultar disponibilidade" })).toBeNull();
  });

  it("hides itself on 'Já resolvi minha hospedagem' and remembers it", () => {
    const { unmount } = render(<LodgingCard slug="abc" options={[featured]} />);
    fireEvent.click(screen.getByRole("button", { name: "Já resolvi minha hospedagem" }));
    expect(screen.queryByText(/Onde ficar/)).toBeNull();
    unmount();
    render(<LodgingCard slug="abc" options={[featured]} />);
    expect(screen.queryByText(/Onde ficar/)).toBeNull();
  });

  it("still renders and hides when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<LodgingCard slug="abc" options={[featured]} />);
    expect(screen.getByText(/Onde ficar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Já resolvi minha hospedagem" }));
    expect(screen.queryByText(/Onde ficar/)).toBeNull();
  });

  it("renders nothing without options", () => {
    const { container } = render(<LodgingCard slug="abc" options={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the 3 most relevant highlights for the tourist's profile", () => {
    const pousada = makePlace({
      highlights: ["🏊 Piscina", "🐾 Pet friendly", "☕ Café da manhã incluso", "👨‍👩‍👧 Ideal para famílias", "Vista mar"],
    });
    render(<LodgingCard slug="abc" options={[pousada]} group="familia" />);
    expect(screen.getByText("☕ Café da manhã incluso")).toBeInTheDocument();
    expect(screen.getByText("👨‍👩‍👧 Ideal para famílias")).toBeInTheDocument();
    expect(screen.getByText("🏊 Piscina")).toBeInTheDocument();
    expect(screen.queryByText("🐾 Pet friendly")).toBeNull();
    expect(screen.queryByText("Vista mar")).toBeNull();
  });

  it("shows the budget in the quiz's words", () => {
    render(<LodgingCard slug="abc" options={[makePlace({ neighborhood: "Campeche", price_range: "R$$" })]} />);
    expect(screen.getByText("Campeche · 💵 Médio")).toBeInTheDocument();
  });

  it("lists the other lodgings with their budget, then Booking with the tourist's stay", () => {
    render(<LodgingCard slug="abc" options={[featured, makePlace({ id: "lux", name: "Resort Luxo", neighborhood: "Jurerê", price_range: "R$$$" })]} />);
    fireEvent.change(screen.getByLabelText("Entrada"), { target: { value: "2027-01-12" } });
    fireEvent.change(screen.getByLabelText("Saída"), { target: { value: "2027-01-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Ver mais opções de hospedagem" }));
    expect(screen.getByText("Jurerê · 💎 Alto")).toBeInTheDocument();
    const booking = screen.getByRole("link", { name: /Ver mais no Booking.com/ });
    expect(booking.getAttribute("href")).toContain("checkin=2027-01-12");
  });

  it("offers Booking even when there is no other partner lodging", () => {
    render(<LodgingCard slug="abc" options={[featured]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver mais opções de hospedagem" }));
    expect(screen.getByRole("link", { name: /Ver mais no Booking.com/ })).toBeInTheDocument();
  });

  it("opens the lodging detail without the map", () => {
    render(<LodgingCard slug="abc" options={[featured]} />);
    fireEvent.click(screen.getByRole("button", { name: /Pousada Sol/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver no mapa/ })).toBeNull();
  });

  it("spells out the guest count", () => {
    render(<LodgingCard slug="abc" options={[featured]} group="solo" />);
    expect(screen.getByText("1 hóspede")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mais hóspedes" }));
    expect(screen.getByText("2 hóspedes")).toBeInTheDocument();
  });
});
