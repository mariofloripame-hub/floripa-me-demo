"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/nav/BottomNav";

interface ActionRowProps {
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
}

function ActionRow({ icon, label, onClick, href }: ActionRowProps) {
  const content = (
    <div className="flex items-center justify-between rounded-card border border-white/10 bg-white/5 p-3">
      <span className="text-sm">
        {icon} {label}
      </span>
      <span className="text-ink-dim">›</span>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
}

export function MaisView({ slug }: { slug: string }) {
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  async function handleShare() {
    await navigator.clipboard.writeText(window.location.href);
    setCopyConfirmed(true);
    setTimeout(() => setCopyConfirmed(false), 3000);
  }

  return (
    <main className="relative min-h-screen pb-24">
      <div className="px-6 pt-10">
        <h1 className="font-display text-xl font-extrabold">Mais</h1>
      </div>
      <div className="mt-6 flex flex-col gap-2 px-4">
        <ActionRow icon="✏️" label="Editar roteiro" href={`/roteiro/${slug}`} />
        <ActionRow icon="🔗" label="Compartilhar link" onClick={handleShare} />
        {copyConfirmed && <p className="px-1 text-xs text-turquoise">Link copiado!</p>}
        <ActionRow icon="🖨️" label="Salvar / imprimir PDF" onClick={() => window.print()} />
        <ActionRow icon="🔄" label="Refazer quiz" href="/quiz" />
      </div>
      <BottomNav slug={slug} />
    </main>
  );
}
