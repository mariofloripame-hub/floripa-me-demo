// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { getDefaultLlmClient } from "./llmClient";

const originalProvider = process.env.LLM_PROVIDER;
const originalKey = process.env.DEEPSEEK_API_KEY;

afterEach(() => {
  if (originalProvider === undefined) delete process.env.LLM_PROVIDER;
  else process.env.LLM_PROVIDER = originalProvider;
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
});

describe("getDefaultLlmClient", () => {
  it("returns an Anthropic client when LLM_PROVIDER is unset", () => {
    delete process.env.LLM_PROVIDER;
    expect(getDefaultLlmClient()).toBeInstanceOf(Anthropic);
  });

  it("returns an Anthropic client when LLM_PROVIDER is explicitly 'anthropic'", () => {
    process.env.LLM_PROVIDER = "anthropic";
    expect(getDefaultLlmClient()).toBeInstanceOf(Anthropic);
  });

  it("returns a DeepSeek client with a callable messages.parse when LLM_PROVIDER=deepseek and a key is set", () => {
    process.env.LLM_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "test-key";
    const client = getDefaultLlmClient();
    expect(client).not.toBeInstanceOf(Anthropic);
    expect(typeof client.messages.parse).toBe("function");
  });

  it("throws a clear error when LLM_PROVIDER=deepseek and DEEPSEEK_API_KEY is missing", () => {
    process.env.LLM_PROVIDER = "deepseek";
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => getDefaultLlmClient()).toThrow(/DEEPSEEK_API_KEY/);
  });
});
