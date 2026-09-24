import { describe, it, expect } from "vitest";
import { buildAvisos } from "./buildAvisos";
import type { EventRow } from "@/lib/supabase/types";

function event(overrides: Partial<EventRow>): EventRow {
  return {
    id: "1", name: "Evento", start_month: 1, end_month: 4, location: "Jurerê",
    target_profiles: ["Todos"], is_free: "Não", active: true, notes: null,
    created_at: "2026-01-01T00:00:00Z", ...overrides,
  };
}

const NOW = new Date("2026-03-15T12:00:00Z"); // March

describe("buildAvisos", () => {
  it("always includes the 4 general tips, regardless of answers", () => {
    const tips = buildAvisos({ answers: {}, events: [], now: NOW });
    const labels = tips.map((t) => t.label);
    expect(labels).toEqual(expect.arrayContaining(["Uber/99", "Estacionamento", "Trânsito", "Cuidados"]));
  });

  it("adds a season tip and matching events when 'when' resolves to a month", () => {
    const events = [event({ id: "in-season", start_month: 1, end_month: 4 })];
    const tips = buildAvisos({ answers: { when: "chegou" }, events, now: NOW });
    expect(tips.some((t) => t.label === "Alta temporada")).toBe(true);
    expect(tips.some((t) => t.label === "Evento")).toBe(true);
  });

  it("omits the season tip and all events when 'when' is 'mais_de_um_mes' or 'planejando'", () => {
    const events = [event({ id: "would-match", start_month: 1, end_month: 4 })];

    const farOut = buildAvisos({ answers: { when: "mais_de_um_mes" }, events, now: NOW });
    expect(farOut.some((t) => t.label === "Alta temporada")).toBe(false);
    expect(farOut).toHaveLength(4); // only the general tips

    const planning = buildAvisos({ answers: { when: "planejando" }, events, now: NOW });
    expect(planning).toHaveLength(4);
  });

  it("omits the season tip and events when 'when' is unanswered (legacy itineraries)", () => {
    const events = [event({ id: "would-match", start_month: 1, end_month: 4 })];
    const tips = buildAvisos({ answers: {}, events, now: NOW });
    expect(tips).toHaveLength(4);
  });

  it("excludes events outside the resolved month", () => {
    const events = [event({ id: "out-of-season", start_month: 7, end_month: 7 })];
    const tips = buildAvisos({ answers: { when: "chegou" }, events, now: NOW });
    expect(tips.some((t) => t.label === "Evento")).toBe(false);
  });

  it("adds a work-related purpose tip for negocios, nothing for passeio", () => {
    const withNegocios = buildAvisos({ answers: { purpose: "negocios" }, events: [], now: NOW });
    expect(withNegocios).toHaveLength(5); // 4 general + 1 purpose

    const withPasseio = buildAvisos({ answers: { purpose: "passeio" }, events: [], now: NOW });
    expect(withPasseio).toHaveLength(4);
  });

  it("tolerates a legacy quiz_answers shape (old timing field, numeric budget) without throwing", () => {
    // old itineraries stored { timing: "agora", budget: 150, ... } — buildAvisos must not crash
    // when it receives that shape cast as QuizAnswers.
    expect(() => buildAvisos({ answers: { timing: "agora" } as never, events: [], now: NOW })).not.toThrow();
  });

  it("puts personalized tips (season/events/purpose) before the general ones, so the collapsed card shows a personalized tip first", () => {
    const tips = buildAvisos({ answers: { when: "chegou", purpose: "negocios" }, events: [], now: NOW });
    expect(tips[0].label).not.toBe("Uber/99");
    expect(["Alta temporada", "Trabalho"]).toContain(tips[0].label);
    // the 4 general tips are still all present, just not first
    const labels = tips.map((t) => t.label);
    expect(labels).toEqual(expect.arrayContaining(["Uber/99", "Estacionamento", "Trânsito", "Cuidados"]));
  });

  it("caps event tips at 3 even when more events match the month", () => {
    const events = [
      event({ id: "e1", name: "Evento 1" }),
      event({ id: "e2", name: "Evento 2" }),
      event({ id: "e3", name: "Evento 3" }),
      event({ id: "e4", name: "Evento 4" }),
    ];
    const tips = buildAvisos({ answers: { when: "chegou" }, events, now: NOW });
    const eventTips = tips.filter((t) => t.icon === "🎉");
    expect(eventTips).toHaveLength(3);
  });
});
