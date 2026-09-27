import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthEnv } from "./authEnv";

// Refreshes the partner's Supabase session cookies (if any) and reports who is logged in.
export async function refreshPartnerSession(
  request: NextRequest,
): Promise<{ userId: string | null; response: NextResponse }> {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseAuthEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { userId: user?.id ?? null, response };
}
