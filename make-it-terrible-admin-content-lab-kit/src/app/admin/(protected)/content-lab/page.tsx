import { ContentLabClient } from "./content-lab-client";

export default function ContentLabPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
          Writers' room
        </p>
        <h1 className="mt-2 text-4xl font-black">Content Lab</h1>
        <p className="mt-2 max-w-3xl text-zinc-400">
          The scenario inspires the joke. Approved responses enter the shared deck and stay inactive until published and separately activated.
        </p>
      </div>
      <ContentLabClient />
    </main>
  );
}
