import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { findPartnerPlaceByEmail } from "@/lib/parceiro/context";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";
import { safeNextPath } from "@/lib/parceiro/safeNextPath";
import { getSupabaseAuthEnv } from "@/lib/parceiro/authEnv";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!z.email().safeParse(email).success) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }
  const next = safeNextPath(typeof body?.next === "string" ? body.next : null);

  // Checked for every email, before the partner lookup, so a 503 reveals nothing.
  try {
    getSupabaseAuthEnv();
  } catch (error) {
    console.error("Partner login unavailable", error);
    return NextResponse.json({ error: "Portal indisponível" }, { status: 503 });
  }

  // Same answer whether or not the email belongs to a partner — never reveal who is one.
  try {
    const place = await findPartnerPlaceByEmail(getSupabaseAdminClient(), email);
    if (place) {
      const supabase = await createPartnerServerClient();
      const origin = new URL(request.url).origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/parceiro/auth/callback?next=${encodeURIComponent(next)}`,
          shouldCreateUser: true,
        },
      });
      if (error) console.error("Partner magic link failed", error);
    }
  } catch (error) {
    console.error("Partner login failed", error);
  }
  return NextResponse.json({ ok: true });
}
