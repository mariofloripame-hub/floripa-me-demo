import { NextResponse } from "next/server";
import { createPartnerServerClient } from "@/lib/parceiro/supabaseServer";
import { safeNextPath } from "@/lib/parceiro/safeNextPath";

// token_hash flow (not PKCE) so the link works even when opened on a
// different device than the one that asked for it.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));

  if (tokenHash && type === "email") {
    const supabase = await createPartnerServerClient();
    const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/parceiro/entrar?erro=link", url.origin));
}
