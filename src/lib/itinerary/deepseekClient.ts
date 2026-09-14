import { ItineraryGenerationSchema } from "./schema";
import type { MessagesParseClient } from "./generate";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

const JSON_SHAPE_INSTRUCTION =
  'Responda SOMENTE com um objeto JSON no formato exato: ' +
  '{"welcome_message": string, "days": [{"day_number": number, "theme": string, ' +
  '"activities": [{"place_id": string, "time": "HH:MM"}]}]}. Sem texto fora do JSON.';

interface ClaudeStyleParseParams {
  system?: string;
  messages: { role: string; content: string }[];
  max_tokens?: number;
}

export function createDeepSeekClient(apiKey: string): MessagesParseClient {
  return {
    messages: {
      parse: async (params) => {
        const { system, messages, max_tokens } = params as ClaudeStyleParseParams;

        const systemContent = [system, JSON_SHAPE_INSTRUCTION].filter(Boolean).join("\n\n");

        const response = await fetch(DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            max_tokens: max_tokens ?? 8000,
            response_format: { type: "json_object" },
            messages: [{ role: "system", content: systemContent }, ...messages],
          }),
        });

        if (!response.ok) {
          const error = new Error(`DeepSeek API error: ${response.status}`);
          (error as Error & { status: number }).status = response.status;
          throw error;
        }

        const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
          return { parsed_output: null };
        }

        try {
          const parsedJson: unknown = JSON.parse(content);
          const result = ItineraryGenerationSchema.safeParse(parsedJson);
          return { parsed_output: result.success ? result.data : null };
        } catch {
          return { parsed_output: null };
        }
      },
    },
  };
}
