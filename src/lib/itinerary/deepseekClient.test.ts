import { describe, it, expect, vi, afterEach } from "vitest";
import { createDeepSeekClient } from "./deepseekClient";

const VALID_RESULT = {
  welcome_message: "Oi! Preparamos um roteiro pra você.",
  days: [{ day_number: 1, theme: "Dia 1", activities: [{ place_id: "1", time: "09:00" }] }],
};

function fetchResolving(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createDeepSeekClient", () => {
  it("sends system and user messages to DeepSeek in JSON mode and returns the validated result", async () => {
    const fetchMock = fetchResolving({
      choices: [{ message: { content: JSON.stringify(VALID_RESULT) } }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createDeepSeekClient("test-key");
    const result = await client.messages.parse({
      system: "Você é um roteirista.",
      messages: [{ role: "user", content: "Monte um roteiro" }],
      max_tokens: 4000,
    });

    expect(result.parsed_output).toEqual(VALID_RESULT);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("deepseek-chat");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0]).toEqual({ role: "system", content: expect.stringContaining("Você é um roteirista.") });
    expect(body.messages[1]).toEqual({ role: "user", content: "Monte um roteiro" });
  });

  it("returns parsed_output: null when the response JSON does not match the itinerary schema", async () => {
    vi.stubGlobal("fetch", fetchResolving({ choices: [{ message: { content: JSON.stringify({ foo: "bar" }) } }] }));

    const client = createDeepSeekClient("test-key");
    const result = await client.messages.parse({ messages: [{ role: "user", content: "oi" }] });

    expect(result.parsed_output).toBeNull();
  });

  it("returns parsed_output: null when the response content is not valid JSON", async () => {
    vi.stubGlobal("fetch", fetchResolving({ choices: [{ message: { content: "não é json" } }] }));

    const client = createDeepSeekClient("test-key");
    const result = await client.messages.parse({ messages: [{ role: "user", content: "oi" }] });

    expect(result.parsed_output).toBeNull();
  });

  it("throws an error carrying the HTTP status when the DeepSeek API responds with a non-OK status", async () => {
    vi.stubGlobal("fetch", fetchResolving({}, false, 429));

    const client = createDeepSeekClient("test-key");

    await expect(client.messages.parse({ messages: [{ role: "user", content: "oi" }] })).rejects.toMatchObject({
      status: 429,
    });
  });
});
