import { z } from "zod";

export const GeneratedCandidateSchema = z.object({
  response_text: z.string().min(3).max(105),
  premise_attack: z.enum([
    "reward_corruption", "escalation", "humiliating_workaround",
    "corrupted_output", "aftermath_whiplash", "activation_condition",
    "audience_or_location", "unrelated_consequence", "other",
  ]),
  portability: z.enum(["high", "medium", "low"]),
  spicy_level: z.enum(["clean", "dark", "crude", "explicit"]),
});

export const GeneratedBatchSchema = z.object({
  scenario_polarity: z.enum(["positive", "negative", "neutral_or_ambiguous"]),
  candidates: z.array(GeneratedCandidateSchema).min(1).max(12),
});

export const GenerateRequestSchema = z.object({
  scenarioId: z.string().uuid().nullable().optional(),
  scenarioText: z.string().trim().min(3).max(500),
  category: z.string().trim().max(100).nullable().optional(),
  count: z.number().int().min(4).max(12).default(8),
  spicyMode: z.enum(["general", "r_rated"]).default("general"),
  inspirationResponse: z.string().trim().max(105).nullable().optional(),
});

export const CandidateDecisionSchema = z.object({
  status: z.enum(["approved", "rejected", "needs_edit"]),
  response_text: z.string().trim().min(3).max(105).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  rejection_reason: z.string().trim().max(500).nullable().optional(),
});
