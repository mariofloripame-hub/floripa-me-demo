import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { listPlaces } from "@/lib/supabase/queries";
import { PlacesTabs } from "@/components/admin/PlacesTabs";

export default async function AdminPage() {
  const places = await listPlaces(getSupabaseAdminClient());
  return (
    <main className="min-h-dvh bg-sand p-6 text-teal-ink">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold text-teal-ink">Estabelecimentos</h1>
        <PlacesTabs initialPlaces={places} />
      </div>
    </main>
  );
}
