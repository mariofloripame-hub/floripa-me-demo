import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { listPlaces, insertPlace } from "@/lib/supabase/queries";
import { adminPlaceFieldsSchema } from "@/lib/estabelecimentos/adminSchema";
import { validatePhotos } from "@/lib/estabelecimentos/schema";
import { uploadPhotos } from "@/lib/estabelecimentos/uploadPhotos";

export async function GET() {
  const places = await listPlaces(getSupabaseAdminClient());
  return NextResponse.json(places);
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  fields.is_verified = formData.get("is_verified") === "true";
  fields.is_partner = formData.get("is_partner") === "true";

  const parsed = adminPlaceFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: "Dados inválidos", fieldErrors }, { status: 400 });
  }

  const photos = formData.getAll("photos").filter((value): value is File => value instanceof File);
  const photoError = validatePhotos(photos);
  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const photoUrls = await uploadPhotos(supabase, photos);
    const created = await insertPlace(supabase, {
      ...parsed.data,
      photos: photoUrls,
      submission_source: "admin",
      target_profiles: [],
      special_needs_tags: [],
      lat: null,
      lng: null,
      google_place_id: null,
      rating: null,
      notes: null,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Admin place creation failed", error);
    return NextResponse.json({ error: "Não foi possível criar o estabelecimento." }, { status: 502 });
  }
}
