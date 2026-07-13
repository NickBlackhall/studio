import { NextRequest } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const category = request.nextUrl.searchParams.get("category")?.trim();
    const randomCount = Math.min(
      5,
      Math.max(0, Number(request.nextUrl.searchParams.get("random") ?? 0)),
    );

    let query = supabase
      .from("scenarios")
      .select("id,text,category")
      .limit(randomCount ? 200 : 30);

    if (search) query = query.ilike("text", `%${search}%`);
    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    if (!randomCount) return Response.json({ scenarios: rows });

    const shuffled = [...rows].sort(() => Math.random() - 0.5).slice(0, randomCount);
    return Response.json({ scenarios: shuffled });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
