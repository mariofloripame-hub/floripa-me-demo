import { describe, it, expect } from "vitest";
import { buildItineraryPrompt, SYSTEM_PROMPT } from "./prompt";
import type { Place } from "@/lib/supabase/types";

function place(overrides: Partial<Place>): Place {
  return {
    id: "1", region: "Sul", neighborhood: "Campeche", name: "Praia do Campeche",
    category: "Praia", target_profiles: ["Todos"], price_range: "Gratuito",
    point_type: "Ponto Turístico", short_description: "Praia extensa.", address: "",
    opening_hours: null, phone: null, instagram: null, notes: null,
    google_place_id: null, lat: null, lng: null, rating: null, photos: [],
    is_partner: false, partner_plan: null, partner_offer: null, partner_status: null,
    special_needs_tags: [], created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SYSTEM_PROMPT", () => {
  it("forbids inventing places outside the candidate list", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("place_id");
    expect(SYSTEM_PROMPT.toLowerCase()).toMatch(/nunca invente|não pode inventar|não invente/);
  });
});

describe("buildItineraryPrompt", () => {
  it("includes every candidate's place_id so Claude can only reference known places", () => {
    const candidates = [place({ id: "p1" }), place({ id: "p2", name: "Ostradamus" })];
    const prompt = buildItineraryPrompt(candidates, {});
    expect(prompt).toContain("place_id: p1");
    expect(prompt).toContain("place_id: p2");
    expect(prompt).toContain("Ostradamus");
  });

  it("translates the days answer into an explicit day count instruction", () => {
    const prompt = buildItineraryPrompt([place({})], { days: "3-4" });
    expect(prompt).toMatch(/exatamente 3 dia/);
  });

  it("defaults to 2 days when no days answer was given", () => {
    const prompt = buildItineraryPrompt([place({})], {});
    expect(prompt).toMatch(/exatamente 2 dia/);
  });

  it("includes readable timing and region labels when informed", () => {
    const prompt = buildItineraryPrompt([place({})], { timing: "aviao", region: "leste" });
    expect(prompt).toContain("chegando de avião");
    expect(prompt).toContain("Leste da Ilha");
  });

  it("tells Claude to use the stay region for logistical ordering", () => {
    const prompt = buildItineraryPrompt([place({})], {});
    expect(prompt.toLowerCase()).toMatch(/região de hospedagem.*ordenar|ordenar.*regi(ã|a)o/);
  });

  it("falls back to a sensible default when timing/region are absent or 'não informar'", () => {
    const prompt = buildItineraryPrompt([place({})], {});
    expect(prompt).toContain("- Chegada: não informado");
    expect(prompt).toContain("- Região de hospedagem: não informado");

    const promptWithNao = buildItineraryPrompt([place({})], { region: "nao" });
    expect(promptWithNao).toContain("- Região de hospedagem: não informado");
  });
});
