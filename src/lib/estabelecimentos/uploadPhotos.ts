import type { SupabaseClient } from "@supabase/supabase-js";

const PHOTO_BUCKET = "establishment-photos";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadPhotos(supabase: SupabaseClient, photos: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos) {
    const extension = EXTENSION_BY_MIME[photo.type] ?? "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    const { data: uploadData, error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo);
    if (error) throw error;
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(uploadData.path);
    urls.push(data.publicUrl);
  }
  return urls;
}
