import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/parceiro/middlewareSession", () => ({ refreshPartnerSession: vi.fn() }));

import { middleware } from "./middleware";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/adminAuth";
import { refreshPartnerSession } from "@/lib/parceiro/middlewareSession";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery-staple");
  vi.mocked(refreshPartnerSession).mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function requestFor(path: string, cookieValue?: string) {
  const headers: Record<string, string> = {};
  if (cookieValue !== undefined) headers.cookie = `${ADMIN_SESSION_COOKIE}=${cookieValue}`;
  return new NextRequest(new URL(path, "http://localhost"), { headers });
}

function partnerSession(userId: string | null) {
  vi.mocked(refreshPartnerSession).mockResolvedValue({ userId, response: NextResponse.next() });
}

describe("middleware — admin", () => {
  it("lets /admin/login through with no cookie", async () => {
    expect((await middleware(requestFor("/admin/login"))).status).toBe(200);
  });

  it("lets /api/admin/login through with no cookie", async () => {
    expect((await middleware(requestFor("/api/admin/login"))).status).toBe(200);
  });

  it("redirects an unauthenticated page request to /admin/login", async () => {
    const response = await middleware(requestFor("/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("returns 401 for an unauthenticated API request", async () => {
    expect((await middleware(requestFor("/api/admin/places"))).status).toBe(401);
  });

  it("lets an authenticated page request through", async () => {
    expect((await middleware(requestFor("/admin", createAdminSessionToken()))).status).toBe(200);
  });

  it("lets an authenticated API request through", async () => {
    expect((await middleware(requestFor("/api/admin/places", createAdminSessionToken()))).status).toBe(200);
  });

  it("blocks a request with a tampered cookie", async () => {
    expect((await middleware(requestFor("/admin", "tampered"))).status).toBe(307);
  });

  it("never consults the partner session for admin paths", async () => {
    await middleware(requestFor("/admin"));
    expect(refreshPartnerSession).not.toHaveBeenCalled();
  });
});

describe("middleware — parceiro", () => {
  it.each(["/parceiro/entrar", "/parceiro/auth/callback", "/api/parceiro/login"])(
    "lets public path %s through without a session",
    async (path) => {
      expect((await middleware(requestFor(path))).status).toBe(200);
      expect(refreshPartnerSession).not.toHaveBeenCalled();
    },
  );

  it("redirects a logged-out page request to the login, remembering where it was going", async () => {
    partnerSession(null);
    const response = await middleware(requestFor("/parceiro/validar"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/parceiro/entrar?next=%2Fparceiro%2Fvalidar");
  });

  it("returns 401 for a logged-out API request", async () => {
    partnerSession(null);
    expect((await middleware(requestFor("/api/parceiro/validar"))).status).toBe(401);
  });

  it("lets a logged-in partner through", async () => {
    partnerSession("user-1");
    expect((await middleware(requestFor("/parceiro"))).status).toBe(200);
  });

  it("sends pages to the login with a notice when the partner auth isn't configured", async () => {
    vi.mocked(refreshPartnerSession).mockRejectedValue(new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await middleware(requestFor("/parceiro/validar"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/parceiro/entrar?erro=config");
  });

  it("returns 503 for APIs when the partner auth isn't configured", async () => {
    vi.mocked(refreshPartnerSession).mockRejectedValue(new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await middleware(requestFor("/api/parceiro/validar"))).status).toBe(503);
  });

  it("does not accept the admin cookie as a partner session", async () => {
    partnerSession(null);
    expect((await middleware(requestFor("/parceiro", createAdminSessionToken()))).status).toBe(307);
  });
});
