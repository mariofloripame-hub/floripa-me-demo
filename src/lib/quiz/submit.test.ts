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

  it("throws a friendly error when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(submitQuizAnswers({})).rejects.toThrow(/não foi possível/i);
  });
});
