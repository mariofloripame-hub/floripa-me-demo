import { describe, it, expect, vi, afterEach } from "vitest";
import { submitQuizAnswers } from "./submit";

describe("submitQuizAnswers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs the answers and returns the created slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ slug: "abc123" }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitQuizAnswers({ timing: "aviao", budget: 150 });

    expect(result).toEqual({ slug: "abc123" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/itineraries",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ answers: { timing: "aviao", budget: 150 } }),
      }),
    );
  });

  it("throws the server's specific error message when the response body has one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: "Não encontramos lugares suficientes para esse perfil ainda." }) }),
    );
    await expect(submitQuizAnswers({})).rejects.toThrow("Não encontramos lugares suficientes para esse perfil ainda.");
  });

  it("falls back to a generic message when the response body isn't parseable JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.reject(new Error("no body")) }));
    await expect(submitQuizAnswers({})).rejects.toThrow(/não foi possível/i);
  });
});
