import type { LodgingDashboard } from "@/lib/hospedagem/dashboard";
import { formatDayMonth, formatTime } from "@/lib/time/saoPaulo";
import { DailyBars } from "./DailyBars";
import { Card, deltaText } from "./DashboardView";

const CHANNEL_LABEL = { whatsapp: "WhatsApp", site: "Site" } as const;

export function LodgingDashboardView({ dashboard }: { dashboard: LodgingDashboard }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-xs font-bold uppercase tracking-wide text-teal-ink/50">Pedidos de disponibilidade</p>
        <p className="font-display text-4xl font-extrabold">{dashboard.requestsThisMonth}</p>
        <p className="text-xs font-bold text-turquoise-deep">{deltaText(dashboard.requestsThisMonth, dashboard.requestsLastMonth)}</p>
        <p className="text-sm text-teal-ink/70">
          💬 {dashboard.whatsappThisMonth} pelo WhatsApp · 🔗 {dashboard.siteThisMonth} pelo site
        </p>
        <DailyBars data={dashboard.requestsPerDay} label="Pedidos de disponibilidade por dia" />
      </Card>

      <Card>
        <p className="font-display text-base font-extrabold">
          Sua hospedagem foi sugerida em {dashboard.suggestedThisMonth} roteiros este mês
        </p>
        <p className="text-sm text-teal-ink/60">Turistas sem hospedagem que receberam você como primeira indicação.</p>
      </Card>

      <Card>
        <h2 className="font-display text-base font-extrabold">Últimos pedidos</h2>
        {dashboard.latestRequests.length === 0 ? (
          <p className="text-sm text-teal-ink/60">Nenhum pedido ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {dashboard.latestRequests.map((request) => (
              <li key={request.createdAt} className="flex justify-between gap-3 border-b border-teal-ink/5 pb-2 last:border-0">
                <span>
                  {CHANNEL_LABEL[request.channel]}
                  {request.stay ? ` · ${request.stay}` : " · sem datas"}
                  {request.guests ? ` · ${request.guests} hóspedes` : ""}
                </span>
                <span className="shrink-0 text-teal-ink/50">
                  {formatDayMonth(new Date(request.createdAt))} {formatTime(new Date(request.createdAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
