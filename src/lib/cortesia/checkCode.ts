import { formatDayMonth, formatTime } from "@/lib/time/saoPaulo";
import type { CourtesyCodeRow } from "./types";

export type CheckResult =
  | { status: "valid"; offerText: string }
  | { status: "not_found" }
  | { status: "used"; redeemedAt: string }
  | { status: "expired" }
  | { status: "other_place" };

export function checkCode(row: CourtesyCodeRow | null, placeId: string, now: Date): CheckResult {
  if (!row) return { status: "not_found" };
  if (row.place_id !== placeId) return { status: "other_place" };
  if (row.redeemed_at) return { status: "used", redeemedAt: row.redeemed_at };
  if (new Date(row.expires_at).getTime() <= now.getTime()) return { status: "expired" };
  return { status: "valid", offerText: row.offer_text };
}

export function checkMessage(result: CheckResult): string {
  switch (result.status) {
    case "valid":
      return `Código válido: ${result.offerText}`;
    case "not_found":
      return "Código não encontrado. Confira as letras com o cliente.";
    case "used": {
      const redeemedAt = new Date(result.redeemedAt);
      return `Este código já foi usado em ${formatDayMonth(redeemedAt)} às ${formatTime(redeemedAt)}.`;
    }
    case "expired":
      return "Código expirado. Peça ao cliente para gerar um novo no app.";
    case "other_place":
      return "Este código é de outro estabelecimento.";
  }
}
