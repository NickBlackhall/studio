import { requireAdmin, adminErrorResponse } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAdmin();
    const { id } = await context.params;
    const supabase = createAdminClient();

    const { data: candidate, error: candidateError } = await supabase
      .from("content_candidates")
      .select("*")
      .eq("id", id)
      .single();
    if (candidateError) throw candidateError;

    if (candidate.status !== "approved") {
      return Response.json(
        { error: "Only approved candidates can be published." },
        { status: 409 },
      );
    }

    if (candidate.published_response_card_id) {
      return Response.json(
        { error: "This candidate has already been published." },
        { status: 409 },
      );
    }

    const { data: duplicate } = await supabase
      .from("response_cards")
      .select("id,text")
      .ilike("text", candidate.response_text)
      .maybeSingle();

    if (duplicate) {
      return Response.json(
        { error: "An exact response card already exists.", duplicate },
        { status: 409 },
      );
    }

    const { data: card, error: insertError } = await supabase
      .from("response_cards")
      .insert({
        text: candidate.response_text,
        is_active: false,
        author_player_id: null,
        author_name: "Admin Content Lab",
      })
      .select("id,text,is_active")
      .single();
    if (insertError) throw insertError;

    const { data: updated, error: updateError } = await supabase
      .from("content_candidates")
      .update({
        status: "published",
        published_response_card_id: card.id,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    await supabase.from("content_candidate_events").insert({
      candidate_id: id,
      event_type: "published",
      previous_text: candidate.response_text,
      new_text: candidate.response_text,
      previous_status: candidate.status,
      new_status: "published",
      reason: "Published to response_cards as inactive.",
      created_by: user.id,
    });

    return Response.json({ candidate: updated, responseCard: card });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
