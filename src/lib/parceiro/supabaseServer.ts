import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAuthEnv } from "./authEnv";

// Supabase Auth client bound to the request cookies — partner identity only.
// Data access still goes through getSupabaseAdminClient().
export async function createPartnerServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseAuthEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}
