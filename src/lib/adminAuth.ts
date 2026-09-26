import { createHash, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "floripa_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD must be set");
  return password;
}

export function createAdminSessionToken(): string {
  return sha256Hex(getAdminPassword());
}

export function isCorrectAdminPassword(candidate: string): boolean {
  try {
    const expected = Buffer.from(sha256Hex(getAdminPassword()));
    const actual = Buffer.from(sha256Hex(candidate));
    return timingSafeEqual(expected, actual);
  } catch {
    // ADMIN_PASSWORD isn't configured — deny access cleanly rather than
    // crash every login attempt (and, via isValidAdminSession below, every
    // /admin request) with an unhandled exception.
    return false;
  }
}

export function isValidAdminSession(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;
  try {
    const expected = Buffer.from(createAdminSessionToken());
    const actual = Buffer.from(cookieValue);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
