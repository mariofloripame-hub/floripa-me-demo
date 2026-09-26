import { z } from "zod";
import { CATEGORY_OPTIONS, REGION_OPTIONS, PRICE_RANGE_OPTIONS } from "./schema";

export const PARTNER_STATUS_OPTIONS = [
  { value: "", label: "Nenhum" },
  { value: "cortesia", label: "Cortesia" },
  { value: "pago", label: "Pago" },
] as const;

const PARTNER_STATUS_VALUES = PARTNER_STATUS_OPTIONS.map((option) => option.value) as [string, ...string[]];

function requiredText(min = 1, message = "Campo obrigatório") {
  return z.string().trim().min(min, message);
}

export const adminPlaceFieldsSchema = z.object({
  name: requiredText(),
  category: z.enum(CATEGORY_OPTIONS),
  point_type: requiredText(),
  short_description: requiredText(10, "Descreva em pelo menos 10 caracteres"),
  region: z.enum(REGION_OPTIONS),
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
  partner_status: z.enum(PARTNER_STATUS_VALUES),
  partner_plan: z.string().trim().optional().default(""),
  partner_offer: z.string().trim().optional().default(""),
});

export type AdminPlaceFields = z.infer<typeof adminPlaceFieldsSchema>;

export const adminPlacePatchSchema = adminPlaceFieldsSchema.partial().extend({
  photos: z.array(z.string()).optional(),
});

export type AdminPlacePatch = z.infer<typeof adminPlacePatchSchema>;
