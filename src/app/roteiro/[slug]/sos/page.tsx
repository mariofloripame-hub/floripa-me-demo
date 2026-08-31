import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { listSosPlaces } from "@/lib/supabase/queries";
import { SosView } from "@/components/roteiro/SosView";

export default async function SosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const places = await listSosPlaces(getSupabaseAdminClient());
  return <SosView slug={slug} places={places} />;
}
