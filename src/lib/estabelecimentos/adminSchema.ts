import { z } from "zod";
import { PRICE_RANGE_OPTIONS } from "./schema";
import { LODGING_CATEGORY } from "@/lib/hospedagem/eligibility";
import { normalizeWhatsapp } from "@/lib/hospedagem/contact";
import { MAX_HIGHLIGHT_LENGTH, orderHighlights } from "@/lib/hospedagem/highlights";

export const PARTNER_STATUS_OPTIONS = [
  { value: "", label: "Nenhum" },
  { value: "cortesia", label: "Cortesia" },
  { value: "pago", label: "Pago" },
] as const;

function requiredText(min = 1, message = "Campo obrigatório") {
  return z.string().trim().min(min, message);
}

// `category`, `region`, and `partner_status` are plain `text` columns with
// no DB constraint — the fixed option lists in schema.ts / above exist only
// to suggest good values in the UI. Validating them as strict enums here
// would block saving (or silently blank a `partner_status`) any pre-existing
// row whose value predates the current list — confirmed to already happen in
// production ("Continente" region; "Cultura / Gastrô" category). So these
// three stay free text: the <select> in AdminPlaceForm still only offers the
// known-good choices, but editing an unrelated field on a legacy row never
// loses or blocks on its current value.
export const adminPlaceFieldsSchema = z.object({
  name: requiredText(),
  category: requiredText(),
  point_type: requiredText(),
  short_description: requiredText(10, "Descreva em pelo menos 10 caracteres"),
  region: requiredText(),
  neighborhood: requiredText(),
  address: requiredText(),
  price_range: z.enum(PRICE_RANGE_OPTIONS),
  opening_hours: requiredText(),
  phone: requiredText(),
  instagram: z.string().trim().optional().default(""),
  contact_name: z.string().trim().optional().default(""),
  contact_email: z.string().trim().optional().default(""),
  contact_phone: z.string().trim().optional().default(""),
  is_verified: z.boolean(),
  is_partner: z.boolean(),
  partner_status: z.string().trim().optional().default(""),
  partner_plan: z.string().trim().optional().default(""),
  partner_offer: z.string().trim().optional().default(""),
  booking_whatsapp: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((value) => value === "" || normalizeWhatsapp(value) !== null, "Número inválido — use DDD + número"),
  booking_url: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), "Use um link começando com http:// ou https://"),
  highlights: z
    .array(z.string().trim().min(1).max(MAX_HIGHLIGHT_LENGTH))
    .optional()
    .default([]),
});

export type AdminPlaceFields = z.infer<typeof adminPlaceFieldsSchema>;

export const adminPlacePatchSchema = adminPlaceFieldsSchema.partial().extend({
  photos: z.array(z.string()).optional(),
});

export type AdminPlacePatch = z.infer<typeof adminPlacePatchSchema>;

type LodgingFieldsInput = {
  category?: string;
  booking_whatsapp?: string | null;
  booking_url?: string | null;
  highlights?: string[] | null;
};
type NormalizedLodgingFields<T> = Omit<T, "booking_whatsapp" | "booking_url" | "highlights"> & {
  booking_whatsapp?: string | null;
  booking_url?: string | null;
  highlights?: string[] | null;
};

// Booking contact and highlights only exist for lodgings; blanks are stored as
// null, and highlights are kept in the curated list's order.
export function normalizeLodgingFields<T extends LodgingFieldsInput>(fields: T): NormalizedLodgingFields<T> {
  const notLodging = fields.category !== undefined && fields.category !== LODGING_CATEGORY;
  const { highlights, ...rest } = fields;
  const result = { ...rest } as NormalizedLodgingFields<T>;
  for (const key of ["booking_whatsapp", "booking_url"] as const) {
    if (notLodging) result[key] = null;
    else if (key in fields) result[key] = fields[key] || null;
  }
  if (notLodging) result.highlights = null;
  else if ("highlights" in fields) {
    const items = orderHighlights(highlights ?? []);
    result.highlights = items.length > 0 ? items : null;
  }
  return result;
}
