const DEFAULT_PATH = "/parceiro";

// Only ever redirect back into the partner portal after login.
export function safeNextPath(next: string | null | undefined): string {
  if (typeof next !== "string") return DEFAULT_PATH;
  if (next !== DEFAULT_PATH && !next.startsWith(`${DEFAULT_PATH}/`)) return DEFAULT_PATH;
  if (next.includes("..") || next.includes("\\") || next.includes("//")) return DEFAULT_PATH;
  return next;
}
