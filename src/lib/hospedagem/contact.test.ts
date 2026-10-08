import { describe, it, expect } from "vitest";
import {
  bookingSearchUrl, buildAvailabilityMessage, defaultGuests, formatStayDate, normalizeWhatsapp, validateStay, whatsappLink,
} from "./contact";

describe("defaultGuests", () => {
  it.each([["solo", 1], ["casal", 2], ["familia", 3], ["amigos", 4], [undefined, 2], ["outro", 2]] as const)(
    "%s → %i", (group, expected) => expect(defaultGuests(group)).toBe(expected),
  );
});

describe("validateStay", () => {
  const today = "2026-10-06";
  it("accepts both empty", () => expect(validateStay({ checkIn: "", checkOut: "" }, today)).toBeNull());
  it("accepts a valid stay", () => expect(validateStay({ checkIn: "2026-10-06", checkOut: "2026-10-09" }, today)).toBeNull());
  it("asks for the check-out", () => expect(validateStay({ checkIn: "2026-10-10", checkOut: "" }, today)).toBe("Preencha a data de saída"));
  it("asks for the check-in", () => expect(validateStay({ checkIn: "", checkOut: "2026-10-10" }, today)).toBe("Preencha a data de entrada"));
  it("rejects a past check-in", () =>
    expect(validateStay({ checkIn: "2026-10-05", checkOut: "2026-10-09" }, today)).toBe("A entrada não pode ser no passado"));
  it("rejects check-out on the check-in day", () =>
    expect(validateStay({ checkIn: "2026-10-09", checkOut: "2026-10-09" }, today)).toBe("A saída precisa ser depois da entrada"));
});

describe("buildAvailabilityMessage", () => {
  it("includes dates and guests", () => {
    expect(buildAvailabilityMessage({ checkIn: "2027-01-12", checkOut: "2027-01-15", guests: 2 })).toBe(
      "Olá! Encontrei vocês no Floripa.My. Vocês têm disponibilidade de 12/01 a 15/01 para 2 pessoas?",
    );
  });
  it("works without dates", () => {
    expect(buildAvailabilityMessage({ checkIn: "", checkOut: "", guests: 3 })).toBe(
      "Olá! Encontrei vocês no Floripa.My. Gostaria de saber sobre disponibilidade para 3 pessoas.",
    );
  });
  it("uses the singular for one guest", () => {
    expect(buildAvailabilityMessage({ checkIn: "", checkOut: "", guests: 1 })).toContain("para 1 pessoa.");
  });
  it("formats dates as dd/MM", () => expect(formatStayDate("2026-03-07")).toBe("07/03"));
});

describe("normalizeWhatsapp", () => {
  it.each([
    ["(48) 99999-0000", "5548999990000"],
    ["048 99999-0000", "5548999990000"],
    ["+55 48 99999-0000", "5548999990000"],
    ["48 3333-0000", "554833330000"],
    ["", null],
    [null, null],
    ["123", null],
  ])("%s → %s", (raw, expected) => expect(normalizeWhatsapp(raw)).toBe(expected));
});

describe("whatsappLink", () => {
  it("builds an encoded wa.me link", () => {
    expect(whatsappLink("(48) 99999-0000", "Olá! 12/01?")).toBe("https://wa.me/5548999990000?text=Ol%C3%A1!%2012%2F01%3F");
  });
  it("returns null without a usable number", () => expect(whatsappLink("", "x")).toBeNull());
});

describe("bookingSearchUrl", () => {
  it("searches Florianópolis with the tourist's dates and guests", () => {
    const url = new URL(bookingSearchUrl({ checkIn: "2027-01-12", checkOut: "2027-01-15", guests: 2 }));
    expect(url.origin + url.pathname).toBe("https://www.booking.com/searchresults.pt-br.html");
    expect(url.searchParams.get("ss")).toBe("Florianópolis");
    expect(url.searchParams.get("checkin")).toBe("2027-01-12");
    expect(url.searchParams.get("checkout")).toBe("2027-01-15");
    expect(url.searchParams.get("group_adults")).toBe("2");
    expect(url.searchParams.get("no_rooms")).toBe("1");
    expect(url.searchParams.has("aid")).toBe(false);
  });

  it("leaves dates out when the tourist has none", () => {
    const url = new URL(bookingSearchUrl({ checkIn: "", checkOut: "", guests: 3 }));
    expect(url.searchParams.has("checkin")).toBe(false);
    expect(url.searchParams.get("group_adults")).toBe("3");
  });

  it("carries the affiliate id once there is one", () => {
    const url = new URL(bookingSearchUrl({ checkIn: "", checkOut: "", guests: 2, affiliateId: "123456" }));
    expect(url.searchParams.get("aid")).toBe("123456");
  });
});
