import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/parceiro/supabaseServer", () => ({ createPartnerServerClient: vi.fn() }));

import { GET } from "./route";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();

beforeEach(() => {
  verifyOtp.mockReset();
  exchangeCodeForSession.mockReset();
  vi.mocked(createPartnerServerClient).mockResolvedValue({ auth: { verifyOtp, exchangeCodeForSession } } as never);
});

describe("GET /parceiro/auth/callback — PKCE fallback", () => {
  it("exchanges a ?code= (first-login confirmation link) for a session and redirects to next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(new Request("https://floripa.my/parceiro/auth/callback?next=%2Fparceiro%2Fvalidar&code=pkce123"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce123");
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro/validar");
  });

  it("sends a failed code exchange back to the login with an error", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    const response = await GET(new Request("https://floripa.my/parceiro/auth/callback?next=%2Fparceiro&code=pkce123"));
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro/entrar?erro=link");
  });
});

describe("GET /parceiro/auth/callback", () => {
  it("verifies the token and redirects to next", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(
      new Request("https://floripa.my/parceiro/auth/callback?next=%2Fparceiro%2Fvalidar&token_hash=abc&type=email"),
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro/validar");
  });

  it("sends an invalid or expired link back to the login with an error", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const response = await GET(new Request("https://floripa.my/parceiro/auth/callback?next=%2Fparceiro&token_hash=abc&type=email"));
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro/entrar?erro=link");
  });

  it("rejects a link without a token", async () => {
    const response = await GET(new Request("https://floripa.my/parceiro/auth/callback?next=%2Fparceiro"));
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro/entrar?erro=link");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("never redirects off-site", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(
      new Request("https://floripa.my/parceiro/auth/callback?next=https%3A%2F%2Fevil.com&token_hash=abc&type=email"),
    );
    expect(response.headers.get("location")).toBe("https://floripa.my/parceiro");
  });
});
