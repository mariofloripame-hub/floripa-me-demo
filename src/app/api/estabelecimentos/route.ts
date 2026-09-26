import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { submitEstablishment, InvalidFieldsError, InvalidPhotosError } from "@/lib/estabelecimentos/submitEstablishment";
import { MAX_PHOTOS, MAX_PHOTO_SIZE_BYTES } from "@/lib/estabelecimentos/schema";

// Slack on top of the photo budget for the text fields themselves and
// multipart boundary overhead.
const MAX_REQUEST_BYTES = MAX_PHOTOS * MAX_PHOTO_SIZE_BYTES + 1024 * 1024;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Envio muito grande." }, { status: 413 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "website") {
      fields[key] = value;
    }
  }
  const honeypotValue = formData.get("website");
  const honeypot = typeof honeypotValue === "string" ? honeypotValue : "";
  const photos = formData.getAll("photos").filter((value): value is File => value instanceof File);

  try {
    await submitEstablishment({ fields, photos, honeypot }, { supabase: getSupabaseAdminClient() });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidFieldsError) {
      return NextResponse.json({ error: "Dados inválidos", fieldErrors: error.fieldErrors }, { status: 400 });
    }
    if (error instanceof InvalidPhotosError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Establishment submission failed", error);
    return NextResponse.json(
      { error: "Não foi possível enviar seu cadastro agora. Tente novamente." },
      { status: 502 },
    );
  }
}
