import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const ADMIN_COOKIE = "content-lab-admin";
const ADMIN_SCOPE = "content-lab";

export class AdminAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 429 | 503 = 401,
  ) {
    super(message);
  }
}

function adminPin(): string | null {
  return (
    process.env.ADMIN_CONTENT_PIN ??
    process.env.MASTER_RESET_PIN ??
    (process.env.NODE_ENV !== "production" ? "6425" : null)
  );
}

function signingSecret(): Uint8Array {
  const value = process.env.ADMIN_SESSION_SECRET ?? process.env.JWT_SECRET;
  if (!value || (process.env.NODE_ENV === "production" && value === "your-jwt-secret-key-here")) {
    throw new AdminAccessError(
      "Admin access is disabled until ADMIN_SESSION_SECRET or JWT_SECRET is configured.",
      503,
    );
  }
  return new TextEncoder().encode(value);
}

function safeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export async function createAdminSession(pin: string): Promise<void> {
  const expected = adminPin();
  if (!expected) {
    throw new AdminAccessError(
      "Admin access is disabled until ADMIN_CONTENT_PIN is configured.",
      503,
    );
  }
  if (!safeEqual(pin, expected)) {
    throw new AdminAccessError("Incorrect administrator PIN.", 403);
  }

  const token = await new SignJWT({ scope: ADMIN_SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(signingSecret());

  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 4 * 60 * 60,
    path: "/",
  });
}

export async function clearAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function requireAdmin(): Promise<{ actor: "pin-admin" }> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) throw new AdminAccessError("Administrator authentication required.", 401);

  try {
    const { payload } = await jwtVerify(token, signingSecret());
    if (payload.scope !== ADMIN_SCOPE) throw new Error("Invalid scope");
  } catch {
    throw new AdminAccessError("Administrator session expired or invalid.", 401);
  }

  return { actor: "pin-admin" };
}

export function adminErrorResponse(error: unknown): Response {
  if (error instanceof AdminAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.name === "ZodError") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  console.error("Admin route failure", error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
