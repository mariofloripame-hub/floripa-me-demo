export const CODE_PREFIX = "FMY-";
// No 0/O, 1/I/L — the code is read aloud at a counter.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_BODY_LENGTH = 4;
export const CODE_TTL_MS = 24 * 60 * 60 * 1000;

function secureRandomInt(max: number): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

export function generateCode(randomInt: (max: number) => number = secureRandomInt): string {
  let body = "";
  for (let i = 0; i < CODE_BODY_LENGTH; i++) {
    body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${CODE_PREFIX}${body}`;
}

export function normalizeCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  const prefix = CODE_PREFIX.replace("-", "");
  const body =
    compact.length === prefix.length + CODE_BODY_LENGTH && compact.startsWith(prefix)
      ? compact.slice(prefix.length)
      : compact;
  if (body.length !== CODE_BODY_LENGTH) return null;
  if (![...body].every((char) => CODE_ALPHABET.includes(char))) return null;
  return `${CODE_PREFIX}${body}`;
}

// What staff type after the fixed "FMY-" shown on screen: a pasted or typed
// prefix is dropped so it never doubles up.
export function toCodeBody(input: string): string {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = CODE_PREFIX.replace("-", "");
  const body = compact.length > CODE_BODY_LENGTH && compact.startsWith(prefix) ? compact.slice(prefix.length) : compact;
  return body.slice(0, CODE_BODY_LENGTH);
}
