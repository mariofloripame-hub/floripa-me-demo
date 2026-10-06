import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/hospedagem/recordLead", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hospedagem/recordLead")>();
  return { ...actual, recordLodgingLead: vi.fn() };
});

import { POST } from "./route";
import { recordLodgingLead, LeadNotAllowedError } from "@/lib/hospedagem/recordLead";

const PLACE_ID = "3f1c2a9e-8b7d-4c6e-9f10-1a2b3c4d5e6f";
const valid = { slug: "abc123", place_id: PLACE_ID, channel: "whatsapp", check_in: "2027-01-12", check_out: "2027-01-15", guests: 2 };
function post(body: unknown) {
  return new Request("http://localhost/api/lodging-leads", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.mocked(recordLodgingLead).mockReset();
});

describe("POST /api/lodging-leads", () => {
  it("records a valid lead", async () => {
    expect((await POST(post(valid))).status).toBe(201);
    expect(recordLodgingLead).toHaveBeenCalledWith({}, valid);
  });

  it("accepts a lead without dates", async () => {
    expect((await POST(post({ ...valid, check_in: null, check_out: null }))).status).toBe(201);
  });

  it.each([
    ["unknown channel", { ...valid, channel: "telefone" }],
    ["non-uuid place", { ...valid, place_id: "nope" }],
    ["check-out before check-in", { ...valid, check_out: "2027-01-10" }],
    ["only one date", { ...valid, check_out: null }],
    ["too many guests", { ...valid, guests: 21 }],
  ])("returns 400 for %s", async (_label, body) => {
    expect((await POST(post(body))).status).toBe(400);
    expect(recordLodgingLead).not.toHaveBeenCalled();
  });

  it("returns 400 when the place was not suggested in that roteiro", async () => {
    vi.mocked(recordLodgingLead).mockRejectedValue(new LeadNotAllowedError());
    expect((await POST(post(valid))).status).toBe(400);
  });

  it("returns 502 on database failure", async () => {
    vi.mocked(recordLodgingLead).mockRejectedValue(new Error("db down"));
    expect((await POST(post(valid))).status).toBe(502);
  });
});
