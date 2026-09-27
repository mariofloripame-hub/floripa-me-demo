import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfferCard } from "./OfferCard";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("OfferCard", () => {
  it("shows the live offer and a pending one", () => {
    render(<OfferCard liveOffer="Café cortesia" pendingOffer="Sobremesa cortesia" hasPending />);
    expect(screen.getByText("Café cortesia")).toBeInTheDocument();
    expect(screen.getByText(/aguardando aprovação/i)).toHaveTextContent("Sobremesa cortesia");
  });

  it("shows a pending removal", () => {
    render(<OfferCard liveOffer="Café cortesia" pendingOffer="" hasPending />);
    expect(screen.getByText(/aguardando aprovação/i)).toHaveTextContent("remover a cortesia");
  });

  it("submits a new offer for approval", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ pending_offer: "Sobremesa", pending_offer_submitted_at: "x" }) });
    render(<OfferCard liveOffer={null} pendingOffer={null} hasPending={false} />);
    fireEvent.change(screen.getByLabelText("Nova cortesia"), { target: { value: "Sobremesa" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar para aprovação" }));
    expect(await screen.findByText(/aguardando aprovação/i)).toHaveTextContent("Sobremesa");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: "Sobremesa" });
  });

  it("offers removal only when there is a live offer", () => {
    const { rerender } = render(<OfferCard liveOffer={null} pendingOffer={null} hasPending={false} />);
    expect(screen.queryByRole("button", { name: "Pedir remoção" })).not.toBeInTheDocument();
    rerender(<OfferCard liveOffer="Café" pendingOffer={null} hasPending={false} />);
    expect(screen.getByRole("button", { name: "Pedir remoção" })).toBeInTheDocument();
  });

  it("limits the text to 120 characters", () => {
    render(<OfferCard liveOffer={null} pendingOffer={null} hasPending={false} />);
    expect(screen.getByLabelText("Nova cortesia")).toHaveAttribute("maxLength", "120");
  });
});
