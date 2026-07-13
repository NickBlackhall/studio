import { ContentLabClient } from "./content-lab-client";

export default function ContentLabPage() {
  return <main className="mx-auto max-w-7xl px-5 py-8">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Writers&apos; room</p>
    <h1 className="mt-2 text-4xl font-black">Content Lab</h1>
    <p className="mt-2 max-w-3xl text-zinc-400">The scenario inspires the joke. Human approval is required, and published cards remain inactive.</p>
    <ContentLabClient />
  </main>;
}
