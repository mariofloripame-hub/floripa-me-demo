import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-syne" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "Floripa.me — Seu roteiro por IA",
  description: "Responda 8 perguntas e receba um roteiro personalizado para Florianópolis, gerado por IA.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0B1416",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="bg-graphite text-ink font-body min-h-screen">
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js')); }`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
