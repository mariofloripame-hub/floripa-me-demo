import { describe, it, expect } from "vitest";
import { resolveLodging } from "./resolveLodging";
import { makePlace } from "./fixtures";

const a = makePlace({ id: "a", contact_email: "dono@pousada.com" });
const b = makePlace({ id: "b" });
const c = makePlace({ id: "c" });
const selection = { featured_id: "a", alternative_ids: ["b", "c"] };

describe("resolveLodging", () => {
  it("returns featured first, then alternatives", () => {
    expect(resolveLodging(selection, [c, b, a]).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("promotes the next alternative when the featured one is no longer a partner", () => {
    const places = [makePlace({ id: "a", is_partner: false }), b, c];
    expect(resolveLodging(selection, places).map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("drops deleted lodgings", () => {
    expect(resolveLodging(selection, [c]).map((p) => p.id)).toEqual(["c"]);
  });

  it("returns nothing without a selection", () => {
    expect(resolveLodging(null, [a])).toEqual([]);
    expect(resolveLodging(undefined, [a])).toEqual([]);
  });

  it("never sends the owner's contact data to the browser", () => {
    expect(resolveLodging(selection, [a])[0]).not.toHaveProperty("contact_email");
  });
});
