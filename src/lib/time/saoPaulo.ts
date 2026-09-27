const TIME_ZONE = "America/Sao_Paulo";
// Brazil abolished daylight saving time in 2019, so São Paulo is a fixed UTC-3.
const UTC_OFFSET = "-03:00";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface SaoPauloParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function saoPauloParts(date: Date): SaoPauloParts {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function dayKey(date: Date): string {
  const { year, month, day } = saoPauloParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatDayMonth(date: Date): string {
  const { month, day } = saoPauloParts(date);
  return `${pad(day)}/${pad(month)}`;
}

export function formatTime(date: Date): string {
  const { hour, minute } = saoPauloParts(date);
  return `${pad(hour)}h${pad(minute)}`;
}

export function monthStart(date: Date, monthOffset = 0): Date {
  const { year, month } = saoPauloParts(date);
  const total = year * 12 + (month - 1) + monthOffset;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return new Date(`${targetYear}-${pad(targetMonth)}-01T00:00:00${UTC_OFFSET}`);
}
