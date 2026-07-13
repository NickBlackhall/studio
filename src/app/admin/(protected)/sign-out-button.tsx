"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return <button className="rounded-md border border-zinc-700 px-3 py-1.5" type="button" onClick={async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }}>Lock</button>;
}
