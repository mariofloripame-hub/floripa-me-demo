import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock("@/lib/parceiro/context", () => ({ findPartnerPlaceByEmail: vi.fn() }));
vi.mock("@/lib/parceiro/supabaseServer", () => ({ createPartnerServerClient: vi.fn() }));
vi.mock("@/lib/parceiro/authEnv", () => ({ getSupabaseAuthEnv: vi.fn() }));

import { POST } from "./route";
import { findPartnerPlaceByEmail } from "@/lib/parceiro/context";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";
import { getSupabaseAuthEnv } from "@/lib/parceiro/authEnv";

const signInWithOtp = vi.fn();

function post(body: unknown) {
  return new Request("https://floripa.my/api/parceiro/login", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  signInWithOtp.mockReset().mockResolvedValue({ error: null });
  vi.mocked(createPartnerServerClient).mockResolvedValue({ auth: { signInWithOtp } } as never);
  vi.mocked(findPartnerPlaceByEmail).mockReset();
  vi.mocked(getSupabaseAuthEnv).mockReset().mockReturnValue({ url: "https://x.supabase.co", anonKey: "anon" });
});

describe("POST /api/parceiro/login", () => {
  it("sends a magic link to a partner email, pointing at the callback with next", async () => {
    vi.mocked(findPartnerPlaceByEmail).mockResolvedValue({ id: "place-a" } as never);
    const response = await POST(post({ email: " carlos@box32.com ", next: "/parceiro/validar" }));
    expect(response.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "carlos@box32.com",
      options: {
        emailRedirectTo: "https://floripa.my/parceiro/auth/callback?next=%2Fparceiro%2Fvalidar",
        shouldCreateUser: true,
      },
    });
  });

  it("answers the same way for a non-partner email, without sending anything", async () => {
    vi.mocked(findPartnerPlaceByEmail).mockResolvedValue(null);
    const response = await POST(post({ email: "curioso@x.com" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("ignores an off-site next", async () => {
    vi.mocked(findPartnerPlaceByEmail).mockResolvedValue({ id: "place-a" } as never);
    await POST(post({ email: "carlos@box32.com", next: "https://evil.com" }));
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBe(
      "https://floripa.my/parceiro/auth/callback?next=%2Fparceiro",
    );
  });

  it("still answers ok when sending fails (logged, not revealed)", async () => {
    vi.mocked(findPartnerPlaceByEmail).mockResolvedValue({ id: "place-a" } as never);
    signInWithOtp.mockResolvedValue({ error: new Error("rate limited") });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(post({ email: "carlos@box32.com" }))).status).toBe(200);
  });

  it("returns 503 (for any email, so partners aren't revealed) when the auth keys are missing", async () => {
    vi.mocked(getSupabaseAuthEnv).mockImplementation(() => {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(post({ email: "curioso@x.com" }))).status).toBe(503);
    expect(findPartnerPlaceByEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    expect((await POST(post({ email: "nao-e-email" }))).status).toBe(400);
  });
});
