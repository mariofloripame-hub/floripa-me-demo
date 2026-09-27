import { describe, it, expect } from "vitest";
import {
  hasPendingOffer,
  isPendingRemoval,
  offerSubmissionPatch,
  offerDecisionPatch,
  NoPendingOfferError,
} from "./pendingOffer";

const now = new Date("2026-09-27T15:00:00Z");

describe("pending offer rules", () => {
  it("a submission timestamp marks a pending offer", () => {
    expect(hasPendingOffer({ pending_offer_submitted_at: null })).toBe(false);
    expect(hasPendingOffer({ pending_offer_submitted_at: now.toISOString() })).toBe(true);
  });

  it("an empty pending text is a removal request", () => {
    expect(isPendingRemoval({ pending_offer: "", pending_offer_submitted_at: now.toISOString() })).toBe(true);
    expect(isPendingRemoval({ pending_offer: "Café", pending_offer_submitted_at: now.toISOString() })).toBe(false);
  });

  it("builds a trimmed submission patch", () => {
    expect(offerSubmissionPatch("  Café cortesia ", now)).toEqual({
      pending_offer: "Café cortesia",
      pending_offer_submitted_at: now.toISOString(),
    });
  });

  it("approving copies the pending text live and clears pending", () => {
    expect(offerDecisionPatch({ pending_offer: "Café", pending_offer_submitted_at: now.toISOString() }, "aprovar")).toEqual({
      partner_offer: "Café",
      pending_offer: null,
      pending_offer_submitted_at: null,
    });
  });

  it("approving a removal request clears the live offer", () => {
    expect(offerDecisionPatch({ pending_offer: "", pending_offer_submitted_at: now.toISOString() }, "aprovar")).toMatchObject({
      partner_offer: null,
    });
  });

  it("rejecting only clears pending", () => {
    expect(offerDecisionPatch({ pending_offer: "Café", pending_offer_submitted_at: now.toISOString() }, "recusar")).toEqual({
      pending_offer: null,
      pending_offer_submitted_at: null,
    });
  });

  it("refuses to decide when nothing is pending", () => {
    expect(() => offerDecisionPatch({ pending_offer: null, pending_offer_submitted_at: null }, "aprovar")).toThrow(NoPendingOfferError);
  });
});
