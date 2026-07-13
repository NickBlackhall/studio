import { NextRequest } from "next/server";
import { AdminAccessError, adminErrorResponse, clearAdminSession, createAdminSession } from "@/lib/admin/auth";
import { checkAdminLoginRateLimit } from "@/lib/admin/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkAdminLoginRateLimit(address)) {
      throw new AdminAccessError("Too many attempts. Try again in ten minutes.", 429);
    }
    const body = await request.json();
    if (typeof body.pin !== "string" || body.pin.length > 64) {
      return Response.json({ error: "A PIN is required." }, { status: 400 });
    }
    await createAdminSession(body.pin);
    return Response.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE() {
  await clearAdminSession();
  return Response.json({ ok: true });
}
