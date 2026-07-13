"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Sign-in failed.");
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fixed inset-0 z-[1000] overflow-y-auto bg-zinc-950 px-6 py-16 text-zinc-100">
      <form onSubmit={submit} className="mx-auto max-w-md space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-7 shadow-2xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">Make It Terrible</p>
          <h1 className="mt-2 text-3xl font-black">Admin Content Lab</h1>
          <p className="mt-2 text-sm text-zinc-400">Enter the administrator PIN. Access expires after four hours.</p>
        </div>
        <label className="block text-sm font-medium">Administrator PIN
          <input className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-center text-xl tracking-[0.3em] outline-none focus:border-amber-400"
            type="password" inputMode="numeric" autoComplete="current-password" required autoFocus
            value={pin} onChange={(event) => setPin(event.target.value)} />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button className="w-full rounded-lg bg-amber-400 px-4 py-3 font-black text-zinc-950 disabled:opacity-50" disabled={loading} type="submit">
          {loading ? "Verifying…" : "Unlock Content Lab"}
        </button>
        <Link className="block text-center text-sm text-zinc-400 hover:text-white" href="/?step=menu">Back to game</Link>
      </form>
    </main>
  );
}
