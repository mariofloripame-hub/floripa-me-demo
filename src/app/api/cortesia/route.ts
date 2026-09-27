import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { issueCode, NoLiveOfferError, RoteiroNotFoundError } from "@/lib/cortesia/issueCode";

const bodySchema = z.object({
  placeId: z.uuid(),
  itinerarySlug: z.string().trim().min(1).max(100),
  deviceId: z.string().trim().min(8).max(100),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  try {
    const issued = await issueCode(getSupabaseAdminClient(), parsed.data);
    return NextResponse.json(issued);
  } catch (error) {
    if (error instanceof NoLiveOfferError) {
      return NextResponse.json({ error: "Este estabelecimento não tem cortesia ativa." }, { status: 409 });
    }
    if (error instanceof RoteiroNotFoundError) {
      return NextResponse.json({ error: "Roteiro não encontrado" }, { status: 404 });
    }
    console.error("Courtesy code issue failed", error);
    return NextResponse.json({ error: "Não foi possível gerar o código." }, { status: 502 });
  }
}
