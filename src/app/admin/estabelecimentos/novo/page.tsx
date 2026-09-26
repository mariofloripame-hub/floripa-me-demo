import { AdminPlaceForm } from "@/components/admin/AdminPlaceForm";
import { AdminHeader } from "@/components/admin/AdminHeader";

export default function NovoEstabelecimentoPage() {
  return (
    <main className="min-h-dvh bg-sand p-6 text-teal-ink">
      <div className="mx-auto max-w-xl">
        <AdminHeader backHref="/admin" />
        <h1 className="mt-6 font-display text-2xl font-extrabold text-teal-ink">Novo estabelecimento</h1>
        <AdminPlaceForm mode="create" />
      </div>
    </main>
  );
}
