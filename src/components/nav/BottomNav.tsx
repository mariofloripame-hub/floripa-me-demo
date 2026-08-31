"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: (slug: string) => string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "roteiro", label: "Roteiro", icon: "🗺️", path: (slug) => `/roteiro/${slug}` },
  { key: "mapa", label: "Mapa", icon: "📍", path: (slug) => `/roteiro/${slug}/mapa` },
  { key: "sos", label: "SOS", icon: "🆘", path: (slug) => `/roteiro/${slug}/sos` },
  { key: "dicas", label: "Dicas", icon: "💡", path: (slug) => `/roteiro/${slug}/dicas` },
  { key: "mais", label: "Mais", icon: "···", path: (slug) => `/roteiro/${slug}/mais` },
];

export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-around border-t border-white/10 bg-white/5 py-2 backdrop-blur-lg">
      {NAV_ITEMS.map((item) => {
        const href = item.path(slug);
        const active = pathname === href;
        return (
          <Link
            key={item.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-bold ${
              active ? (item.key === "sos" ? "text-coral" : "text-turquoise") : "text-ink-dim"
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
