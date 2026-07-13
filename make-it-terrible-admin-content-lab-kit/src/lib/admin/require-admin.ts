import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export class AdminAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 = 401,
  ) {
    super(message);
  }
}

export async function requireAdmin(): Promise<{ user: User }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AdminAccessError("Authentication required.", 401);
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", {
    check_user_id: user.id,
  });

  if (adminError || isAdmin !== true) {
    throw new AdminAccessError("Administrator access required.", 403);
  }

  return { user };
}

export function adminErrorResponse(error: unknown): Response {
  if (error instanceof AdminAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("Admin route failure", error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
