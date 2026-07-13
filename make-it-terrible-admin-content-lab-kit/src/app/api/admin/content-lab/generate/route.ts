import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { requireAdmin, adminErrorResponse } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GenerateRequestSchema,
  GeneratedBatchSchema,
} from "@/lib/content-lab/schema";
import {
  CONTENT_LAB_SYSTEM_PROMPT,
  buildGenerationInput,
} from "@/lib/content-lab/prompt";
import { findClosestDuplicate } from "@/lib/content-lab/similarity";

export async function POST(request: Request) {
  try {
    const { user } = await requireAdmin();
    const input = GenerateRequestSchema.parse(await request.json());
    const supabase = createAdminClient();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-5.6";

    const [referenceResult, cooldownResult, existingResult] = await Promise.all([
      supabase
        .from("content_reference_examples")
        .select("response_text,verdict,notes")
        .eq("is_active", true)
        .limit(200),
      supabase
        .from("content_motif_cooldowns")
        .select("motif,status,reason,replacement_direction")
        .eq("is_active", true),
      supabase.from("response_cards").select("text").limit(5000),
    ]);

    if (referenceResult.error) throw referenceResult.error;
    if (cooldownResult.error) throw cooldownResult.error;
    if (existingResult.error) throw existingResult.error;

    const references = referenceResult.data ?? [];
    const approvedExamples = references
      .filter((row) => row.verdict === "approved")
      .sort(() => Math.random() - 0.5)
      .slice(0, 28)
      .map((row) => row.response_text);
    const rejectedExamples = references
      .filter((row) => row.verdict !== "approved")
      .slice(0, 12)
      .map((row) => ({ text: row.response_text, reason: row.notes }));
    const cooldowns = (cooldownResult.data ?? []).map(
      (row) =>
        `${row.motif} (${row.status}): ${row.reason ?? ""} ${row.replacement_direction ?? ""}`,
    );

    const response = await openai.responses.parse({
      model,
      input: [
        { role: "system", content: CONTENT_LAB_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildGenerationInput({
            scenarioText: input.scenarioText,
            category: input.category,
            count: input.count,
            spicyMode: input.spicyMode,
            inspirationResponse: input.inspirationResponse,
            approvedExamples,
            rejectedExamples,
            cooldowns,
          }),
        },
      ],
      text: {
        format: zodTextFormat(GeneratedBatchSchema, "make_it_terrible_candidates"),
      },
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new Error("The model returned no structured candidate batch.");
    }

    const existingTexts = (existingResult.data ?? []).map((row) => row.text);
    const deduped = parsed.candidates
      .map((candidate, index) => {
        const duplicate = findClosestDuplicate(candidate.response_text, existingTexts);
        return { candidate, duplicate, rank: index + 1 };
      })
      .filter(({ duplicate }) => duplicate.score < 1)
      .slice(0, input.count);

    const moderation = deduped.length
      ? await openai.moderations.create({
          model: "omni-moderation-latest",
          input: deduped.map(({ candidate }) => candidate.response_text),
        })
      : null;

    const { data: session, error: sessionError } = await supabase
      .from("content_generation_sessions")
      .insert({
        created_by: user.id,
        source_scenario_id: input.scenarioId ?? null,
        scenario_text: input.scenarioText,
        category: input.category ?? null,
        scenario_polarity: parsed.scenario_polarity,
        prompt_version: "v1",
        model,
        requested_count: input.count,
        inspiration_response: input.inspirationResponse ?? null,
        model_request_id: response._request_id ?? null,
      })
      .select("id")
      .single();

    if (sessionError) throw sessionError;

    const rows = deduped.map(({ candidate, duplicate, rank }, index) => {
      const moderationResult = moderation?.results[index];
      return {
        session_id: session.id,
        source_scenario_id: input.scenarioId ?? null,
        original_response_text: candidate.response_text,
        response_text: candidate.response_text,
        premise_attack: candidate.premise_attack,
        portability: candidate.portability,
        spicy_level: candidate.spicy_level,
        generation_rank: rank,
        status: "generated",
        duplicate_score: duplicate.score,
        duplicate_against: duplicate.score >= 0.72 ? duplicate.text : null,
        moderation_flagged: moderationResult?.flagged ?? false,
        moderation_categories: moderationResult?.categories ?? {},
        created_by: user.id,
      };
    });

    const { data: candidates, error: candidateError } = await supabase
      .from("content_candidates")
      .insert(rows)
      .select("*")
      .order("generation_rank");

    if (candidateError) throw candidateError;

    if (candidates?.length) {
      await supabase.from("content_candidate_events").insert(
        candidates.map((candidate) => ({
          candidate_id: candidate.id,
          event_type: "generated",
          new_text: candidate.response_text,
          new_status: candidate.status,
          created_by: user.id,
        })),
      );
    }

    return Response.json({
      sessionId: session.id,
      scenarioPolarity: parsed.scenario_polarity,
      candidates: candidates ?? [],
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
