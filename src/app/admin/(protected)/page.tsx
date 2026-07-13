import Link from "next/link";

export default function AdminDashboardPage() {
  return <main className="mx-auto max-w-6xl px-5 py-10">
    <h1 className="text-4xl font-black">Content administration</h1>
    <p className="mt-2 max-w-2xl text-zinc-400">Generate, review, and publish inactive response cards without changing the normal player flow.</p>
    <div className="mt-8 grid gap-5 md:grid-cols-2">
      <Link href="/admin/content-lab" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 hover:border-amber-400">
        <h2 className="text-2xl font-black">Content Lab</h2><p className="mt-2 text-zinc-400">Pick or import a scenario and generate response candidates.</p>
      </Link>
      <Link href="/admin/cards" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 hover:border-amber-400">
        <h2 className="text-2xl font-black">Review Queue</h2><p className="mt-2 text-zinc-400">Review approvals, export CSV, or publish cards inactive.</p>
      </Link>
    </div>
  </main>;
}
