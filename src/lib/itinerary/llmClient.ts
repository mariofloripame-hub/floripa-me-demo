import Anthropic from "@anthropic-ai/sdk";
import { createDeepSeekClient } from "./deepseekClient";
import type { MessagesParseClient } from "./generate";

export function getDefaultLlmClient(): MessagesParseClient {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";

  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("LLM_PROVIDER=deepseek requer a variável DEEPSEEK_API_KEY configurada.");
    }
    return createDeepSeekClient(apiKey);
  }

  return new Anthropic() as unknown as MessagesParseClient;
}
