import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { lodgingLeadSchema } from "@/lib/hospedagem/leadSchema";
import { LeadNotAllowedError, recordLodgingLead } from "@/lib/hospedagem/recordLead";

export async function POST(request: Request) {
  const parsed = lodgingLeadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  try {
    await recordLodgingLead(getSupabaseAdminClient(), parsed.data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof LeadNotAllowedError) {
      return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
    }
    console.error("Lodging lead recording failed", error);
    return NextResponse.json({ error: "Não foi possível registrar." }, { status: 502 });
  }
}
