import type { ReactNode } from "react";
import type { Dashboard } from "@/lib/parceiro/dashboard";
import { formatDayMonth, formatTime } from "@/lib/time/saoPaulo";
import { DailyBars } from "./DailyBars";
import { OfferCard } from "./OfferCard";

const UPSELL_TEXT = "Ative uma cortesia e veja quantos clientes vieram pelo Floripa.My";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`flex flex-col gap-3 rounded-card border border-teal-ink/10 bg-white p-5 ${className}`}>{children}</section>;
}

function formatPercent(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1).replace(".", ",")}%`;
}

function deltaText(current: number, previous: number): string {
  const diff = current - previous;
  if (diff > 0) return `↑ ${diff} vs mês anterior`;
  if (diff < 0) return `↓ ${-diff} vs mês anterior`;
  return "= mês anterior";
}

function Upsell() {
  return (
    <Card className="border-coral/30 bg-coral/5">
      <p className="font-display text-base font-extrabold">{UPSELL_TEXT}</p>
      <p className="text-sm text-teal-ink/60">
        Uma cortesia simples (um café, uma sobremesa) faz cada cliente que veio pelo roteiro aparecer aqui.
      </p>
      <a href="#cortesia" className="self-start rounded-pill bg-coral px-4 py-2 text-sm font-bold text-graphite">
        Ativar cortesia
      </a>
    </Card>
  );
}

export function DashboardView({
  dashboard,
  plan,
  liveOffer,
  pendingOffer,
  hasPending,
}: {
  dashboard: Dashboard;
  plan: string | null;
  liveOffer: string | null;
  pendingOffer: string | null;
  hasPending: boolean;
}) {
  const showVisits = dashboard.visitsMode !== "upsell";

  return (
    <div className="flex flex-col gap-4">
      {dashboard.visitsMode !== "full" && <Upsell />}

      {showVisits && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">Visitas confirmadas</p>
            <p className="font-display text-4xl font-extrabold">{dashboard.visitsThisMonth}</p>
            <p className="text-xs font-bold text-turquoise-deep">{deltaText(dashboard.visitsThisMonth, dashboard.visitsLastMonth)}</p>
            <DailyBars data={dashboard.visitsPerDay} label="Visitas confirmadas por dia" />
          </Card>
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">Taxa de conversão</p>
            <p className="font-display text-4xl font-extrabold">{formatPercent(dashboard.conversionRate)}</p>
            <p className="text-xs text-teal-ink/60">Visitas confirmadas ÷ roteiros em que você apareceu este mês</p>
          </Card>
        </div>
      )}

      {showVisits && (
        <Card>
          <h2 className="font-display text-base font-extrabold">Últimas visitas</h2>
          {dashboard.latestVisits.length === 0 ? (
            <p className="text-sm text-teal-ink/60">Nenhuma visita confirmada ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-teal-ink/5">
              {dashboard.latestVisits.map((visit) => (
                <li key={visit.redeemedAt} className="flex justify-between gap-3 py-2 text-sm">
                  <span>{visit.offerText}</span>
                  <span className="shrink-0 text-teal-ink/60">
                    {formatDayMonth(new Date(visit.redeemedAt))} · {formatTime(new Date(visit.redeemedAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {dashboard.visitorProfile.length > 0 && (
        <Card>
          <h2 className="font-display text-base font-extrabold">Perfil dos visitantes</h2>
          <p className="text-xs text-teal-ink/60">Quem realmente veio este mês</p>
          <ul className="flex flex-wrap gap-2">
            {dashboard.visitorProfile.map((slice) => (
              <li key={slice.group} className="rounded-pill bg-sand px-3 py-1.5 text-sm font-bold">
                {slice.emoji} {slice.label} · {slice.count}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">Interesse</p>
        <p className="font-display text-lg font-extrabold">
          Seu estabelecimento apareceu em {dashboard.appearancesThisMonth} roteiros este mês
        </p>
        <DailyBars data={dashboard.appearancesPerDay} label="Aparições em roteiros por dia" />
      </Card>

      <Card>
        <h2 className="font-display text-base font-extrabold">Roteiros recentes</h2>
        {dashboard.recentRoteiros.length === 0 ? (
          <p className="text-sm text-teal-ink/60">Seu estabelecimento ainda não apareceu em roteiros.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-teal-ink/5">
            {dashboard.recentRoteiros.map((roteiro) => (
              <li key={roteiro.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold">{roteiro.summary}</p>
                  <p className="text-xs text-teal-ink/50">{roteiro.when}</p>
                </div>
                {roteiro.redeemed && (
                  <span className="shrink-0 rounded-pill bg-turquoise/15 px-2 py-1 text-[11px] font-bold text-turquoise-deep">
                    ✓ Cortesia resgatada
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <OfferCard liveOffer={liveOffer} pendingOffer={pendingOffer} hasPending={hasPending} />

      {!plan?.toLowerCase().includes("premium") && (
        <Card className="bg-teal-ink text-sand">
          <p className="font-display text-base font-extrabold">Quer ainda mais destaque?</p>
          <p className="text-sm text-sand/70">No plano Premium seu estabelecimento tem prioridade nas sugestões dos roteiros.</p>
        </Card>
      )}
    </div>
  );
}
