export const MIN_GUESTS = 1;
export const MAX_GUESTS = 20;

const GUESTS_BY_GROUP: Record<string, number> = { solo: 1, casal: 2, familia: 3, amigos: 4 };

export function defaultGuests(group: string | undefined): number {
  return (group && GUESTS_BY_GROUP[group]) || 2;
}

// Dates are the `YYYY-MM-DD` strings of <input type="date">, so plain string
// comparison orders them correctly.
export function validateStay(stay: { checkIn: string; checkOut: string }, today: string): string | null {
  const { checkIn, checkOut } = stay;
  if (!checkIn && !checkOut) return null;
  if (!checkOut) return "Preencha a data de saída";
  if (!checkIn) return "Preencha a data de entrada";
  if (checkIn < today) return "A entrada não pode ser no passado";
  if (checkOut <= checkIn) return "A saída precisa ser depois da entrada";
  return null;
}

export function formatStayDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

export function buildAvailabilityMessage({ checkIn, checkOut, guests }: { checkIn: string; checkOut: string; guests: number }): string {
  const people = guests === 1 ? "1 pessoa" : `${guests} pessoas`;
  const intro = "Olá! Encontrei vocês no Floripa.My.";
  if (checkIn && checkOut) {
    return `${intro} Vocês têm disponibilidade de ${formatStayDate(checkIn)} a ${formatStayDate(checkOut)} para ${people}?`;
  }
  return `${intro} Gostaria de saber sobre disponibilidade para ${people}.`;
}

// Accepts what people type in the admin: masks, a trunk "0", or +55.
export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

export function whatsappLink(raw: string | null | undefined, message: string): string | null {
  const number = normalizeWhatsapp(raw);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}
