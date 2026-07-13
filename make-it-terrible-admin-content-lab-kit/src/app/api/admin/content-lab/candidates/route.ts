import { NextRequest } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const status = request.nextUrl.searchParams.get("status");

    let query = supabase
      .from("content_candidates")
      .select("*, content_generation_sessions(scenario_text,category)")
      .order("created_at", { ascending: false })
      .limit(250);

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ candidates: data ?? [] });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
