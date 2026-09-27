import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

import { PendingOfferReview } from "./PendingOfferReview";

const fetchMock = vi.fn();
beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

const pending = { id: "p1", partner_offer: "Café", pending_offer: "Sobremesa", pending_offer_submitted_at: "2026-09-27T15:00:00Z" };

describe("PendingOfferReview", () => {
  it("renders nothing without a pending offer", () => {
    const { container } = render(<PendingOfferReview place={{ ...pending, pending_offer_submitted_at: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current and proposed offer", () => {
    render(<PendingOfferReview place={pending} />);
    expect(screen.getByText("Café")).toBeInTheDocument();
    expect(screen.getByText("Sobremesa")).toBeInTheDocument();
    expect(screen.getByText(/enviada pelo parceiro em 27\/09/i)).toBeInTheDocument();
  });

  it("labels a removal request", () => {
    render(<PendingOfferReview place={{ ...pending, pending_offer: "" }} />);
    expect(screen.getByText("Pedido de remoção da cortesia")).toBeInTheDocument();
  });

  it("approves and refreshes the page", async () => {
    render(<PendingOfferReview place={pending} />);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/places/p1/oferta", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "aprovar" });
  });

  it("rejects", async () => {
    render(<PendingOfferReview place={pending} />);
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "recusar" });
  });
});
