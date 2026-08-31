import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ItineraryGenerationSchema, type ItineraryGeneration } from "./schema";
import { SYSTEM_PROMPT, buildItineraryPrompt } from "./prompt";
import type { Place } from "@/lib/supabase/types";
import type { QuizAnswers } from "@/lib/quiz/types";

export interface MessagesParseClient {
  messages: {
    parse: (params: unknown) => Promise<{ parsed_output: ItineraryGeneration | null }>;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && (status === 429 || status >= 500);
}

export async function generateItinerary(
  candidates: Place[],
  answers: QuizAnswers,
  client: MessagesParseClient = new Anthropic() as unknown as MessagesParseClient,
  maxAttempts = 3,
): Promise<ItineraryGeneration> {
  const prompt = buildItineraryPrompt(candidates, answers);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(ItineraryGenerationSchema) },
      });
      if (!response.parsed_output) throw new Error("Claude did not return parsed_output");
      return response.parsed_output;
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === maxAttempts - 1) throw error;
      await sleep(300 * 2 ** attempt);
    }
  }
  throw lastError;
}
