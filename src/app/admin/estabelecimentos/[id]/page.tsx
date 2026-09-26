import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPlaceById } from "@/lib/supabase/queries";
import { AdminPlaceForm } from "@/components/admin/AdminPlaceForm";
import { AdminHeader } from "@/components/admin/AdminHeader";

export default async function EditarEstabelecimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await getPlaceById(getSupabaseAdminClient(), id);
  if (!place) notFound();
  return (
    <main className="min-h-dvh bg-sand p-6 text-teal-ink">
      <div className="mx-auto max-w-xl">
        <AdminHeader backHref="/admin" />
        <h1 className="mt-6 font-display text-2xl font-extrabold text-teal-ink">Editar estabelecimento</h1>
        <AdminPlaceForm mode="edit" place={place} />
      </div>
    </main>
  );
}
