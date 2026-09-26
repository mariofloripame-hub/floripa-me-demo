import { AdminPlaceForm } from "@/components/admin/AdminPlaceForm";

export default function NovoEstabelecimentoPage() {
  return (
    <main className="min-h-dvh bg-sand p-6 text-teal-ink">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-extrabold text-teal-ink">Novo estabelecimento</h1>
        <AdminPlaceForm mode="create" />
      </div>
    </main>
  );
}
