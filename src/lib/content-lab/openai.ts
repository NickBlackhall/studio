import "server-only";

import { GeneratedBatchSchema } from "./schema";

const candidateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scenario_polarity", "candidates"],
  properties: {
    scenario_polarity: { type: "string", enum: ["positive", "negative", "neutral_or_ambiguous"] },
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["response_text", "premise_attack", "portability", "spicy_level"],
        properties: {
          response_text: { type: "string", minLength: 3, maxLength: 105 },
          premise_attack: { type: "string", enum: [
            "reward_corruption", "escalation", "humiliating_workaround", "corrupted_output",
            "aftermath_whiplash", "activation_condition", "audience_or_location",
            "unrelated_consequence", "other",
          ] },
          portability: { type: "string", enum: ["high", "medium", "low"] },
          spicy_level: { type: "string", enum: ["clean", "dark", "crude", "explicit"] },
        },
      },
    },
  },
} as const;

async function openAIRequest(path: string, body: unknown): Promise<{ json: any; requestId: string | null }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    console.error("OpenAI request failed", response.status, json?.error?.type);
    throw new Error(json?.error?.message || "OpenAI request failed.");
  }
  return { json, requestId: response.headers.get("x-request-id") };
}

export async function generateStructuredBatch(system: string, input: string) {
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const { json, requestId } = await openAIRequest("responses", {
    model,
    input: [{ role: "system", content: system }, { role: "user", content: input }],
    text: { format: { type: "json_schema", name: "make_it_terrible_candidates", strict: true, schema: candidateSchema } },
  });
  const text = json.output?.flatMap((item: any) => item.content ?? [])
    .find((item: any) => item.type === "output_text")?.text;
  if (!text) throw new Error("The model returned no structured candidate batch.");
  return { batch: GeneratedBatchSchema.parse(JSON.parse(text)), requestId, model };
}

export async function moderateTexts(texts: string[]) {
  if (!texts.length) return [];
  const { json } = await openAIRequest("moderations", { model: "omni-moderation-latest", input: texts });
  return json.results ?? [];
}
