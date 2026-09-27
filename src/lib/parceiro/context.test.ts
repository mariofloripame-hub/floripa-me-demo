import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/supabase/queries", () => ({ listPartners: vi.fn() }));
vi.mock("./supabaseServer", () => ({ createPartnerServerClient: vi.fn() }));

import { findPartnerPlaceByEmail, getPartnerContext } from "./context";
import { listPartners } from "@/lib/supabase/queries";
import { createPartnerServerClient } from "./supabaseServer";

const box32 = { id: "place-a", name: "Box 32", contact_email: "carlos@box32.com" };

beforeEach(() => {
  vi.mocked(listPartners).mockReset().mockResolvedValue([
    { id: "place-b", name: "Outro", contact_email: null },
    box32,
  ] as never);
});

function sessionWith(user: { id: string; email?: string } | null) {
  vi.mocked(createPartnerServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as unknown as Awaited<ReturnType<typeof createPartnerServerClient>>);
}

describe("findPartnerPlaceByEmail", () => {
  it("matches ignoring case and surrounding spaces", async () => {
    await expect(findPartnerPlaceByEmail({} as SupabaseClient, " Carlos@BOX32.com ")).resolves.toEqual(box32);
  });

  it("returns null when no partner has that email", async () => {
    await expect(findPartnerPlaceByEmail({} as SupabaseClient, "ninguem@x.com")).resolves.toBeNull();
  });
});

describe("getPartnerContext", () => {
  it("returns the user and their place", async () => {
    sessionWith({ id: "user-1", email: "carlos@box32.com" });
    await expect(getPartnerContext()).resolves.toEqual({ userId: "user-1", email: "carlos@box32.com", place: box32 });
  });

  it("is null without a session", async () => {
    sessionWith(null);
    await expect(getPartnerContext()).resolves.toBeNull();
  });

  it("is null when the logged-in email is no longer a partner's", async () => {
    sessionWith({ id: "user-2", email: "ex-parceiro@x.com" });
    await expect(getPartnerContext()).resolves.toBeNull();
  });
});
