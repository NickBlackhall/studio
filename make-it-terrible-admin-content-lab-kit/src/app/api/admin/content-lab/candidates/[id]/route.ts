import { CandidateDecisionSchema } from "@/lib/content-lab/schema";
import { requireAdmin, adminErrorResponse } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAdmin();
    const { id } = await context.params;
    const input = CandidateDecisionSchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: current, error: currentError } = await supabase
      .from("content_candidates")
      .select("*")
      .eq("id", id)
      .single();
    if (currentError) throw currentError;

    const nextText = input.response_text ?? current.response_text;
    const edited = nextText !== current.response_text;

    const { data: updated, error: updateError } = await supabase
      .from("content_candidates")
      .update({
        response_text: nextText,
        status: input.status,
        admin_notes: input.notes ?? current.admin_notes,
        rejection_reason:
          input.status === "rejected"
            ? input.rejection_reason ?? "Rejected by admin"
            : null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    await supabase.from("content_candidate_events").insert({
      candidate_id: id,
      event_type: edited
        ? "edited"
        : input.status === "approved"
          ? "approved"
          : "rejected",
      previous_text: current.response_text,
      new_text: nextText,
      previous_status: current.status,
      new_status: input.status,
      reason: input.rejection_reason ?? input.notes ?? null,
      created_by: user.id,
    });

    return Response.json({ candidate: updated });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
