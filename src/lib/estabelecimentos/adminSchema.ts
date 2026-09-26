import { z } from "zod";
import { PRICE_RANGE_OPTIONS } from "./schema";

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
});

export type AdminPlaceFields = z.infer<typeof adminPlaceFieldsSchema>;

export const adminPlacePatchSchema = adminPlaceFieldsSchema.partial().extend({
  photos: z.array(z.string()).optional(),
});

export type AdminPlacePatch = z.infer<typeof adminPlacePatchSchema>;
