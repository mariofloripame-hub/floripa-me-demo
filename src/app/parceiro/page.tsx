import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { getPartnerContext } from "@/lib/parceiro/context";
import { loadDashboard } from "@/lib/parceiro/loadDashboard";
import { liveOfferText } from "@/lib/cortesia/liveOffers";
import { hasPendingOffer } from "@/lib/ofertas/pendingOffer";
import { PartnerShell } from "@/components/parceiro/PartnerShell";
import { DashboardView } from "@/components/parceiro/DashboardView";
import { LodgingDashboardView } from "@/components/parceiro/LodgingDashboardView";
import { isLodging } from "@/lib/hospedagem/eligibility";
import { loadLodgingDashboard } from "@/lib/hospedagem/loadDashboard";

// Reads live data behind the partner session on every visit.
export const dynamic = "force-dynamic";

export default async function PainelParceiroPage() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect(`/parceiro/entrar?next=${encodeURIComponent("/parceiro")}`);
  const { place } = ctx;
  const client = getSupabaseAdminClient();
  if (isLodging(place)) {
    const lodgingDashboard = await loadLodgingDashboard(client, place);
    return (
      <PartnerShell placeName={place.name} plan={place.partner_plan} active="painel" showValidate={false}>
        <LodgingDashboardView dashboard={lodgingDashboard} />
      </PartnerShell>
    );
  }
  const dashboard = await loadDashboard(client, place);
  return (
    <PartnerShell placeName={place.name} plan={place.partner_plan} active="painel">
      <DashboardView
        dashboard={dashboard}
        plan={place.partner_plan}
        liveOffer={liveOfferText(place)}
        pendingOffer={place.pending_offer ?? null}
        hasPending={hasPendingOffer({ pending_offer_submitted_at: place.pending_offer_submitted_at ?? null })}
      />
    </PartnerShell>
  );
}
