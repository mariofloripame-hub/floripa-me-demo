import { z } from "zod";
import { CATEGORY_STYLES } from "@/lib/itinerary/mapIcons";

export const CATEGORY_OPTIONS = Object.keys(CATEGORY_STYLES) as [string, ...string[]];
export const REGION_OPTIONS = ["Sul", "Leste", "Norte", "Centro", "Universitário"] as const;
export const PRICE_RANGE_OPTIONS = ["Gratuito", "R$", "R$$", "R$$$"] as const;

function requiredText(min = 1, message = "Campo obrigatório") {
  return z.string().trim().min(min, message);
}

export const establishmentFieldsSchema = z.object({
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
  contact_name: requiredText(),
  contact_email: z.string().trim().email("Email inválido"),
  contact_phone: requiredText(),
});

export type EstablishmentFields = z.infer<typeof establishmentFieldsSchema>;

export const MAX_PHOTOS = 6;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePhotos(photos: File[]): string | null {
  if (photos.length > MAX_PHOTOS) {
    return `Envie no máximo ${MAX_PHOTOS} fotos.`;
  }
  for (const photo of photos) {
    if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
      return "As fotos devem estar em formato JPG, PNG ou WEBP.";
    }
    if (photo.size > MAX_PHOTO_SIZE_BYTES) {
      return "Cada foto deve ter no máximo 5MB.";
    }
  }
  return null;
}
