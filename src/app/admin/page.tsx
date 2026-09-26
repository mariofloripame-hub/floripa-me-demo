import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { listPlaces } from "@/lib/supabase/queries";
import { PlacesTabs } from "@/components/admin/PlacesTabs";
import { AdminHeader } from "@/components/admin/AdminHeader";

// This page reads live data behind the admin session cookie on every visit
// — it must never be statically prerendered at build time (which would also
// require live Supabase credentials to exist in the build environment).
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const places = await listPlaces(getSupabaseAdminClient());
  return (
    <main className="min-h-dvh bg-sand p-6 text-teal-ink">
      <div className="mx-auto max-w-3xl">
        <AdminHeader />
        <h1 className="mt-6 font-display text-2xl font-extrabold text-teal-ink">Estabelecimentos</h1>
        <PlacesTabs initialPlaces={places} />
      </div>
    </main>
  );
}
