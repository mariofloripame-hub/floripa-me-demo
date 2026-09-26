import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPlaceById, updatePlace } from "@/lib/supabase/queries";
import { validatePhotos, MAX_PHOTOS } from "@/lib/estabelecimentos/schema";
import { uploadPhotos } from "@/lib/estabelecimentos/uploadPhotos";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const photos = formData.getAll("photos").filter((value): value is File => value instanceof File);
  const photoError = validatePhotos(photos);
  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const place = await getPlaceById(supabase, id);
  if (!place) {
    return NextResponse.json({ error: "Estabelecimento não encontrado" }, { status: 404 });
  }

  if (place.photos.length + photos.length > MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Esse estabelecimento já tem ${place.photos.length} foto(s); no máximo ${MAX_PHOTOS} no total.` },
      { status: 400 },
    );
  }

  try {
    const newUrls = await uploadPhotos(supabase, photos);
    const updated = await updatePlace(supabase, id, { photos: [...place.photos, ...newUrls] });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Admin photo upload failed", error);
    return NextResponse.json({ error: "Não foi possível enviar as fotos." }, { status: 502 });
  }
}
