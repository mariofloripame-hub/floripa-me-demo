import { describe, it, expect } from "vitest";
import { purposeTip } from "./purposeTips";

describe("purposeTip", () => {
  it("returns a work-focused tip for negocios and estudo_congresso", () => {
    expect(purposeTip("negocios")?.label).toBeTruthy();
    expect(purposeTip("estudo_congresso")?.label).toBeTruthy();
  });

  it("returns a trilhas/treino tip for atividade_fisica", () => {
    expect(purposeTip("atividade_fisica")?.label).toBeTruthy();
  });

  it("returns null for passeio, familia_amigos, and unanswered", () => {
    expect(purposeTip("passeio")).toBeNull();
    expect(purposeTip("familia_amigos")).toBeNull();
    expect(purposeTip(undefined)).toBeNull();
  });
});
