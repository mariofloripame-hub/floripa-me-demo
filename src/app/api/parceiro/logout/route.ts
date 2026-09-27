import { NextResponse } from "next/server";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";

export async function POST() {
  const supabase = await createPartnerServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
