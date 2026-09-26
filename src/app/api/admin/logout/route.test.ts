import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";

describe("POST /api/admin/logout", () => {
  it("clears the session cookie", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? "").toBe("");
  });
});
