import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { submitEstablishment, InvalidFieldsError, InvalidPhotosError } from "@/lib/estabelecimentos/submitEstablishment";

export async function POST(request: Request) {
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
