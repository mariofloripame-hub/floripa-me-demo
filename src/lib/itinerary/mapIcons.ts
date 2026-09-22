export interface CategoryStyle {
  color: string;
  path: string;
}

const COLORS = {
  blue: "#00A8E0",
  turquoise: "#00E6C8",
  coral: "#FF7A59",
  turquoiseDeep: "#007367",
  coralDeep: "#A8391F",
  graphiteDeep: "#123542",
};

const GOLD = "#F2B705";

const DEFAULT_STYLE: CategoryStyle = {
  color: COLORS.graphiteDeep,
  path: "M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z",
};

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  Praia: { color: COLORS.blue, path: "M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0M5 13l5-9 3 5 2-3 4 5" },
  Trilha: { color: COLORS.blue, path: "M4 20l6-16 3 8 2-4 5 12M8 20h8" },
  Natureza: { color: COLORS.blue, path: "M12 3 6 14h4l-3 7h10l-3-7h4Z" },
  Mirante: { color: COLORS.blue, path: "M3 18 9 6l4 7 2-3 6 8H3Z" },
  Atividade: {
    color: COLORS.turquoise,
    path: "M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8",
  },
  Esporte: { color: COLORS.turquoise, path: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20" },
  Passeio: { color: COLORS.turquoise, path: "M4 19c4-10 12-10 16 0M8 19V9l4-4 4 4v10" },
  Gastronomia: { color: COLORS.coral, path: "M7 2v8a2 2 0 0 0 4 0V2M9 10v12M17 2c-2 0-3 2-3 5s1 5 3 5v10" },
  "Café / Padaria": {
    color: COLORS.coral,
    path: "M4 8h13a3 3 0 0 1 0 6h-1M4 8v8a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4v-2M4 8l1-4h8l1 4",
  },
  Cultura: { color: COLORS.turquoiseDeep, path: "M4 10 12 4l8 6M5 10v9h14v-9M9 19v-6h6v6" },
  "Bar / Noturno": { color: COLORS.coralDeep, path: "M5 4h14l-6 8v7h3v1H8v-1h3v-7L5 4Z" },
  "Beach Club": { color: COLORS.coralDeep, path: "M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9ZM3 15h18M3 19h18" },
};

export function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? DEFAULT_STYLE;
}

export type PinVariant = "stop" | "partner" | "suggestion";

export function categoryIconOptions(
  category: string,
  variant: PinVariant,
): { html: string; className: string; iconSize: [number, number]; iconAnchor: [number, number] } {
  const style = getCategoryStyle(category);
  const size = variant === "suggestion" ? 26 : 34;
  const border = variant === "partner" ? `3px solid ${GOLD}` : "2px solid #fff";
  const opacity = variant === "suggestion" ? "0.85" : "1";
  const iconSize = Math.round(size * 0.55);
  const html =
    `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${style.color};` +
    `border:${border};opacity:${opacity};box-shadow:0 1px 4px rgba(0,0,0,.4);` +
    `display:flex;align-items:center;justify-content:center">` +
    `<svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="#fff" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${style.path}"/></svg>` +
    `</div>`;
  return { html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] };
}
