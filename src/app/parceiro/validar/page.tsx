import { redirect } from "next/navigation";
import { getPartnerContext } from "@/lib/parceiro/context";
import { PartnerShell } from "@/components/parceiro/PartnerShell";
import { ValidateCodeForm } from "@/components/parceiro/ValidateCodeForm";

export const dynamic = "force-dynamic";

export default async function ValidarPage() {
  const ctx = await getPartnerContext();
  if (!ctx) redirect(`/parceiro/entrar?next=${encodeURIComponent("/parceiro/validar")}`);
  return (
    <PartnerShell placeName={ctx.place.name} plan={ctx.place.partner_plan} active="validar">
      <ValidateCodeForm />
    </PartnerShell>
  );
}
