import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery-staple");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

import { middleware } from "./middleware";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/adminAuth";

function requestFor(path: string, cookieValue?: string) {
  const headers: Record<string, string> = {};
  if (cookieValue !== undefined) headers.cookie = `${ADMIN_SESSION_COOKIE}=${cookieValue}`;
  return new NextRequest(new URL(path, "http://localhost"), { headers });
}

describe("middleware", () => {
  it("lets /admin/login through with no cookie", () => {
    expect(middleware(requestFor("/admin/login")).status).toBe(200);
  });

  it("lets /api/admin/login through with no cookie", () => {
    expect(middleware(requestFor("/api/admin/login")).status).toBe(200);
  });

  it("redirects an unauthenticated page request to /admin/login", () => {
    const response = middleware(requestFor("/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
  });

  it("returns 401 for an unauthenticated API request", () => {
    expect(middleware(requestFor("/api/admin/places")).status).toBe(401);
  });

  it("lets an authenticated page request through", () => {
    expect(middleware(requestFor("/admin", createAdminSessionToken())).status).toBe(200);
  });

  it("lets an authenticated API request through", () => {
    expect(middleware(requestFor("/api/admin/places", createAdminSessionToken())).status).toBe(200);
  });

  it("blocks a request with a tampered cookie", () => {
    expect(middleware(requestFor("/admin", "tampered")).status).toBe(307);
  });
});
