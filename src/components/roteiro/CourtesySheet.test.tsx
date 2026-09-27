import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CourtesySheet } from "./CourtesySheet";
import { writeCachedCode } from "@/lib/cortesia/deviceStorage";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

function renderSheet() {
  return render(<CourtesySheet placeId="place-a" placeName="Ostradamus" itinerarySlug="abc123" onClose={() => {}} />);
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("CourtesySheet", () => {
  it("generates a code when there is none cached and caches it", async () => {
    fetchMock.mockReturnValueOnce(jsonResponse(200, { code: "FMY-4K7P", offerText: "Sobremesa cortesia", expiresAt: "2999-01-01T00:00:00Z" }));
    renderSheet();
    expect(await screen.findByText("FMY-4K7P")).toBeInTheDocument();
    expect(screen.getByText("Sobremesa cortesia")).toBeInTheDocument();
    expect(screen.getByText("Mostre este código no balcão")).toBeInTheDocument();
    expect(screen.getByText(/uso único/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/cortesia");
    expect(JSON.parse(init.body)).toMatchObject({ placeId: "place-a", itinerarySlug: "abc123" });
    expect(window.localStorage.getItem("floripa_cortesia_place-a")).toContain("FMY-4K7P");
  });

  it("shows the cached code without generating a new one", async () => {
    writeCachedCode("place-a", { code: "FMY-AAAA", offerText: "Sobremesa", expiresAt: "2999-01-01T00:00:00Z", redeemedAt: null });
    fetchMock.mockReturnValueOnce(jsonResponse(200, { status: "active", expiresAt: "2999-01-01T00:00:00Z" }));
    renderSheet();
    expect(await screen.findByText("FMY-AAAA")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/api\/cortesia\/FMY-AAAA\?deviceId=/);
  });

  it("keeps showing the cached code when offline", async () => {
    writeCachedCode("place-a", { code: "FMY-AAAA", offerText: "Sobremesa", expiresAt: "2999-01-01T00:00:00Z", redeemedAt: null });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderSheet();
    expect(await screen.findByText("FMY-AAAA")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("FMY-AAAA")).toBeInTheDocument();
  });

  it("shows the used state once the partner validated it", async () => {
    writeCachedCode("place-a", { code: "FMY-AAAA", offerText: "Sobremesa", expiresAt: "2999-01-01T00:00:00Z", redeemedAt: null });
    fetchMock.mockReturnValueOnce(jsonResponse(200, { status: "used", redeemedAt: "2026-09-27T16:10:00Z" }));
    renderSheet();
    expect(await screen.findByText("✓ Cortesia usada em 27/09")).toBeInTheDocument();
  });

  it("offers a retry when generation fails", async () => {
    fetchMock
      .mockReturnValueOnce(jsonResponse(502, { error: "x" }))
      .mockReturnValueOnce(jsonResponse(200, { code: "FMY-4K7P", offerText: "Sobremesa", expiresAt: "2999-01-01T00:00:00Z" }));
    renderSheet();
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("FMY-4K7P")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
