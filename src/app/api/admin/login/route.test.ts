import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery-staple");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

import { POST } from "./route";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/adminAuth";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/admin/login", { method: "POST", body: JSON.stringify(body) }) as never;
}

describe("POST /api/admin/login", () => {
  it("sets the session cookie and returns ok on the correct password", async () => {
    const response = await POST(jsonRequest({ password: "correct-horse-battery-staple" }));
    expect(response.status).toBe(200);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.value).toBe(createAdminSessionToken());
  });

  it("returns 401 without setting a cookie on the wrong password", async () => {
    const response = await POST(jsonRequest({ password: "wrong" }));
    expect(response.status).toBe(401);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toBeUndefined();
  });

  it("returns 401 when the body has no password field", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(401);
  });

  it("marks the cookie secure in production, so it's never sent over plain HTTP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(jsonRequest({ password: "correct-horse-battery-staple" }));
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.secure).toBe(true);
  });
});
