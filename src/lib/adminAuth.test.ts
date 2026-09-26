import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createAdminSessionToken, isCorrectAdminPassword, isValidAdminSession } from "./adminAuth";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery-staple");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isCorrectAdminPassword", () => {
  it("accepts the correct password", () => {
    expect(isCorrectAdminPassword("correct-horse-battery-staple")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(isCorrectAdminPassword("wrong")).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(isCorrectAdminPassword("")).toBe(false);
  });
});

describe("createAdminSessionToken / isValidAdminSession", () => {
  it("accepts the token createAdminSessionToken produces", () => {
    expect(isValidAdminSession(createAdminSessionToken())).toBe(true);
  });

  it("rejects a missing cookie value", () => {
    expect(isValidAdminSession(undefined)).toBe(false);
    expect(isValidAdminSession(null)).toBe(false);
    expect(isValidAdminSession("")).toBe(false);
  });

  it("rejects a tampered token of the same length", () => {
    const token = createAdminSessionToken();
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(isValidAdminSession(tampered)).toBe(false);
  });

  it("rejects a value of a completely different length without throwing", () => {
    expect(() => isValidAdminSession("short")).not.toThrow();
    expect(isValidAdminSession("short")).toBe(false);
  });
});

describe("when ADMIN_PASSWORD is not configured", () => {
  it("isCorrectAdminPassword returns false instead of throwing", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(() => isCorrectAdminPassword("anything")).not.toThrow();
    expect(isCorrectAdminPassword("anything")).toBe(false);
  });

  it("isValidAdminSession returns false instead of throwing", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(() => isValidAdminSession("anything")).not.toThrow();
    expect(isValidAdminSession("anything")).toBe(false);
  });
});
