"use client";

import { useEffect, useState } from "react";
import type { ContentCandidate } from "@/types/content-lab";

type QueueCandidate = ContentCandidate & {
  content_generation_sessions?: {
    scenario_text: string;
    category: string | null;
  } | null;
};

export function ReviewQueueClient() {
  const [status, setStatus] = useState("approved");
  const [rows, setRows] = useState<QueueCandidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch(`/api/admin/content-lab/candidates?status=${status}`);
    const json = await response.json();
    setRows(json.candidates ?? []);
  }

  useEffect(() => {
    void load();
  }, [status]);

  async function publish(id: string) {
    setMessage(null);
    const response = await fetch(`/api/admin/content-lab/candidates/${id}/publish`, {
      method: "POST",
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error ?? "Publish failed.");
      return;
    }
    setMessage("Published as an inactive response card.");
    await load();
  }

  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="approved">Approved</option>
          <option value="generated">Unreviewed</option>
          <option value="needs_edit">Needs edit</option>
          <option value="rejected">Rejected</option>
          <option value="published">Published</option>
          <option value="all">All</option>
        </select>
        <a
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold"
          href="/api/admin/content-lab/export"
        >
          Export approved CSV
        </a>
        {message ? <p className="text-sm text-amber-300">{message}</p> : null}
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
          >
            <p className="text-xs text-zinc-500">
              {row.content_generation_sessions?.scenario_text ?? "Manual scenario"}
            </p>
            <p className="mt-1 text-lg font-bold">{row.response_text}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <span>{row.character_count} characters</span>
              <span>{row.status}</span>
              {row.moderation_flagged ? <span className="text-red-400">Review flag</span> : null}
              {row.status === "approved" ? (
                <button
                  className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-black text-zinc-950"
                  onClick={() => publish(row.id)}
                  type="button"
                >
                  Publish inactive
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!rows.length ? <p className="text-zinc-500">No cards in this view.</p> : null}
      </div>
    </section>
  );
}
