import { BrandWordmark } from "@/components/clube/BrandWordmark";
import { PartnerLoginForm } from "@/components/parceiro/PartnerLoginForm";
import { safeNextPath } from "@/lib/parceiro/safeNextPath";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next, erro } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center bg-sand p-6">
      <header className="flex w-full justify-center py-2">
        <BrandWordmark />
      </header>
      <PartnerLoginForm
        next={safeNextPath(next)}
        linkError={erro === "link"}
        unavailable={erro === "config"}
        whatsapp={process.env.WHATSAPP_CONTATO || undefined}
      />
    </main>
  );
}
