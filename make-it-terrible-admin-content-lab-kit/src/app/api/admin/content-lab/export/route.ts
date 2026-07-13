import { randomUUID } from "node:crypto";
import { requireAdmin, adminErrorResponse } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createResponseCardsCsv } from "@/lib/content-lab/csv";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("content_candidates")
      .select("response_text")
      .eq("status", "approved")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const now = new Date().toISOString();
    const csv = createResponseCardsCsv(
      (data ?? []).map((row) => ({
        text: row.response_text,
        id: randomUUID(),
        createdAt: now,
      })),
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="response_cards_admin_export.csv"',
      },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
