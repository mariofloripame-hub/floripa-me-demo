// Browser-only helpers. Storage can be blocked (private mode), so every access
// is guarded and the feature degrades to "works for this page view".
const DEVICE_KEY = "floripa_device_id";
let memoryDeviceId: string | null = null;

export interface CachedCode {
  code: string;
  offerText: string;
  expiresAt: string;
  redeemedAt: string | null;
}

function codeKey(placeId: string): string {
  return `floripa_cortesia_${placeId}`;
}

export function getDeviceId(): string {
  try {
    const stored = window.localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    memoryDeviceId ??= crypto.randomUUID();
    return memoryDeviceId;
  }
}

export function readCachedCode(placeId: string, now: Date = new Date()): CachedCode | null {
  try {
    const raw = window.localStorage.getItem(codeKey(placeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCode;
    if (typeof parsed?.code !== "string" || typeof parsed.expiresAt !== "string") return null;
    if (new Date(parsed.expiresAt).getTime() <= now.getTime()) return null;
    return { ...parsed, redeemedAt: parsed.redeemedAt ?? null };
  } catch {
    return null;
  }
}

export function writeCachedCode(placeId: string, value: CachedCode): void {
  try {
    window.localStorage.setItem(codeKey(placeId), JSON.stringify(value));
  } catch {
    // Storage blocked — the code still shows for this page view.
  }
}

export function clearCachedCode(placeId: string): void {
  try {
    window.localStorage.removeItem(codeKey(placeId));
  } catch {
    // Nothing to clear.
  }
}
