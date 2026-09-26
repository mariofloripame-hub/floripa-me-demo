import type { SupabaseClient } from "@supabase/supabase-js";
import { establishmentFieldsSchema, validatePhotos } from "./schema";
import { insertPlace } from "@/lib/supabase/queries";
import { uploadPhotos } from "./uploadPhotos";

export class InvalidFieldsError extends Error {
  fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super("Dados do formulário inválidos");
    this.fieldErrors = fieldErrors;
  }
}

export class InvalidPhotosError extends Error {}

export interface SubmitEstablishmentInput {
  fields: Record<string, unknown>;
  photos: File[];
  honeypot: string;
}

export interface SubmitEstablishmentDeps {
  supabase: SupabaseClient;
}

export async function submitEstablishment(
  input: SubmitEstablishmentInput,
  deps: SubmitEstablishmentDeps,
): Promise<{ skipped: boolean }> {
  if (input.honeypot.trim() !== "") {
    return { skipped: true };
  }

  const parsed = establishmentFieldsSchema.safeParse(input.fields);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    throw new InvalidFieldsError(fieldErrors);
  }

  const photoError = validatePhotos(input.photos);
  if (photoError) {
    throw new InvalidPhotosError(photoError);
  }

  const photoUrls = await uploadPhotos(deps.supabase, input.photos);

  await insertPlace(deps.supabase, {
    ...parsed.data,
    photos: photoUrls,
    is_verified: false,
    is_partner: false,
    submission_source: "self_signup",
    target_profiles: [],
    special_needs_tags: [],
    lat: null,
    lng: null,
    google_place_id: null,
    rating: null,
    notes: null,
    partner_plan: null,
    partner_offer: null,
    partner_status: null,
  });

  return { skipped: false };
}
