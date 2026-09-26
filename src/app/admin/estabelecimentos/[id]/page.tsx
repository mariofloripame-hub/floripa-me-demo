import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPlaceById } from "@/lib/supabase/queries";
import { AdminPlaceForm } from "@/components/admin/AdminPlaceForm";

export default async function EditarEstabelecimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await getPlaceById(getSupabaseAdminClient(), id);
  if (!place) notFound();
  return (
    <main className="min-h-dvh bg-sand p-6 text-teal-ink">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-extrabold text-teal-ink">Editar estabelecimento</h1>
        <AdminPlaceForm mode="edit" place={place} />
      </div>
    </main>
  );
}
