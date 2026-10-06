import { z } from "zod";
import { MAX_GUESTS, MIN_GUESTS } from "./contact";

export const lodgingLeadSchema = z
  .object({
    slug: z.string().trim().min(1).max(100),
    place_id: z.uuid(),
    channel: z.enum(["whatsapp", "site"]),
    check_in: z.iso.date().nullable(),
    check_out: z.iso.date().nullable(),
    guests: z.number().int().min(MIN_GUESTS).max(MAX_GUESTS).nullable(),
  })
  .refine((lead) => (lead.check_in === null) === (lead.check_out === null), "Informe as duas datas ou nenhuma")
  .refine((lead) => !lead.check_in || !lead.check_out || lead.check_out > lead.check_in, "Saída depois da entrada");

export type LodgingLeadInput = z.infer<typeof lodgingLeadSchema>;
