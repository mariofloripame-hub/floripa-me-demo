import { dayKey, formatDayMonth, formatTime } from "@/lib/time/saoPaulo";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function validityLabel(expiresAt: string, now: Date): string {
  const expires = new Date(expiresAt);
  const expiresDay = dayKey(expires);
  const when =
    expiresDay === dayKey(now)
      ? "hoje"
      : expiresDay === dayKey(new Date(now.getTime() + DAY_MS))
        ? "amanhã"
        : formatDayMonth(expires);
  return `válido até ${when}, ${formatTime(expires)}`;
}

export function usedLabel(redeemedAt: string): string {
  return `✓ Cortesia usada em ${formatDayMonth(new Date(redeemedAt))}`;
}

export function relativeTime(iso: string, now: Date): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed < MINUTE_MS) return "agora";
  if (elapsed < HOUR_MS) return `há ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `há ${Math.floor(elapsed / HOUR_MS)} h`;
  const days = Math.floor(elapsed / DAY_MS);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}
