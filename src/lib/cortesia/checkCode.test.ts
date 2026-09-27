import { describe, it, expect } from "vitest";
import { checkCode, checkMessage } from "./checkCode";
import type { CourtesyCodeRow } from "./types";

const now = new Date("2026-09-27T15:00:00Z");

function row(overrides: Partial<CourtesyCodeRow> = {}): CourtesyCodeRow {
  return {
    id: "c1", code: "FMY-4K7P", place_id: "place-a", itinerary_id: "it-1", device_id: "dev-1",
    offer_text: "Sobremesa cortesia", created_at: "2026-09-27T12:00:00Z",
    expires_at: "2026-09-28T12:00:00Z", redeemed_at: null, redeemed_by: null,
    ...overrides,
  };
}

describe("checkCode", () => {
  it("is not_found when there is no row", () => {
    expect(checkCode(null, "place-a", now)).toEqual({ status: "not_found" });
  });

  it("is other_place when the code belongs to another establishment", () => {
    expect(checkCode(row({ place_id: "place-b" }), "place-a", now)).toEqual({ status: "other_place" });
  });

  it("is used when already redeemed, carrying when", () => {
    expect(checkCode(row({ redeemed_at: "2026-09-27T16:10:00Z" }), "place-a", now)).toEqual({
      status: "used",
      redeemedAt: "2026-09-27T16:10:00Z",
    });
  });

  it("is expired at or after expires_at", () => {
    expect(checkCode(row({ expires_at: "2026-09-27T15:00:00Z" }), "place-a", now)).toEqual({ status: "expired" });
  });

  it("is valid with the offer text snapshotted at generation (even if the live offer changed or was removed)", () => {
    expect(checkCode(row({ offer_text: "Texto antigo" }), "place-a", now)).toEqual({
      status: "valid",
      offerText: "Texto antigo",
    });
  });
});

describe("checkMessage", () => {
  it("uses the spec's copy for each outcome", () => {
    expect(checkMessage({ status: "valid", offerText: "Sobremesa cortesia" })).toBe("Código válido: Sobremesa cortesia");
    expect(checkMessage({ status: "not_found" })).toBe("Código não encontrado. Confira as letras com o cliente.");
    expect(checkMessage({ status: "expired" })).toBe("Código expirado. Peça ao cliente para gerar um novo no app.");
    expect(checkMessage({ status: "other_place" })).toBe("Este código é de outro estabelecimento.");
  });

  it("shows the São Paulo date and time a code was used", () => {
    expect(checkMessage({ status: "used", redeemedAt: "2026-09-27T16:10:00Z" })).toBe(
      "Este código já foi usado em 27/09 às 13h10.",
    );
  });
});
