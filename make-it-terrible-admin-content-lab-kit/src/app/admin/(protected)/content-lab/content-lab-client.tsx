"use client";

import Papa from "papaparse";
import { useEffect, useMemo, useState } from "react";
import type { ContentCandidate, ScenarioOption } from "@/types/content-lab";

const categories = [
  "Life Things",
  "Super Powers",
  "Absurd & Surreal",
  "Pop Culture & Internet",
  "R-Rated",
];

type ImportedScenario = { text: string; category?: string };

export function ContentLabClient() {
  const [scenarioText, setScenarioText] = useState("");
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [category, setCategory] = useState("Life Things");
  const [count, setCount] = useState(8);
  const [search, setSearch] = useState("");
  const [scenarioResults, setScenarioResults] = useState<ScenarioOption[]>([]);
  const [imported, setImported] = useState<ImportedScenario[]>([]);
  const [candidates, setCandidates] = useState<ContentCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (search.trim().length < 2) {
      setScenarioResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/admin/scenarios?search=${encodeURIComponent(search)}`);
      if (!response.ok) return;
      const json = await response.json();
      setScenarioResults(json.scenarios ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const approvedCount = useMemo(
    () => candidates.filter((item) => item.status === "approved").length,
    [candidates],
  );

  function chooseScenario(item: ScenarioOption | ImportedScenario) {
    setScenarioText(item.text);
    setCategory(item.category?.trim() || "Life Things");
    setScenarioId("id" in item ? item.id : null);
    setSearch("");
    setScenarioResults([]);
  }

  async function generate(inspirationResponse?: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/content-lab/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          scenarioText,
          category,
          count: inspirationResponse ? 4 : count,
          spicyMode: category === "R-Rated" ? "r_rated" : "general",
          inspirationResponse: inspirationResponse ?? null,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Generation failed.");
      setCandidates((current) => [...(json.candidates ?? []), ...current]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function decide(
    candidate: ContentCandidate,
    status: "approved" | "rejected" | "needs_edit",
    responseText = candidate.response_text,
    rejectionReason?: string,
  ) {
    const response = await fetch(`/api/admin/content-lab/candidates/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        response_text: responseText,
        rejection_reason: rejectionReason ?? null,
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "Could not save decision.");
      return;
    }
    setCandidates((current) =>
      current.map((item) => (item.id === candidate.id ? json.candidate : item)),
    );
  }

  function importCsv(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const rows = result.data
          .map((row) => ({
            text: (row.text ?? row.scenario ?? row.scenario_text ?? "").trim(),
            category: (row.category ?? "").trim() || undefined,
          }))
          .filter((row) => row.text);
        setImported(rows);
      },
      error(parseError) {
        setError(parseError.message);
      },
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div>
          <label className="text-sm font-bold">Search existing scenarios</label>
          <input
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            placeholder="Search scenario text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {scenarioResults.length ? (
            <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950">
              {scenarioResults.map((item) => (
                <button
                  key={item.id}
                  className="block w-full border-b border-zinc-800 px-3 py-2 text-left text-sm hover:bg-zinc-900"
                  onClick={() => chooseScenario(item)}
                  type="button"
                >
                  <span className="block font-semibold">{item.text}</span>
                  <span className="text-xs text-zinc-500">{item.category}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-bold">Import scenario CSV</label>
          <input
            className="mt-2 block w-full text-sm text-zinc-400"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importCsv(file);
            }}
          />
          {imported.length ? (
            <select
              className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              defaultValue=""
              onChange={(event) => {
                const row = imported[Number(event.target.value)];
                if (row) chooseScenario(row);
              }}
            >
              <option value="" disabled>
                Choose from {imported.length} imported scenarios
              </option>
              {imported.map((item, index) => (
                <option key={`${item.text}-${index}`} value={index}>
                  {item.text}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <label className="block text-sm font-bold">
          Category
          <select
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-bold">
          Scenario
          <textarea
            className="mt-2 min-h-32 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={scenarioText}
            onChange={(event) => {
              setScenarioText(event.target.value);
              setScenarioId(null);
            }}
          />
        </label>

        <label className="block text-sm font-bold">
          Candidate count: {count}
          <input
            className="mt-2 w-full"
            type="range"
            min={4}
            max={12}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </label>

        <button
          className="w-full rounded-lg bg-amber-400 px-4 py-3 font-black text-zinc-950 disabled:opacity-50"
          disabled={loading || scenarioText.trim().length < 3}
          onClick={() => generate()}
          type="button"
        >
          {loading ? "Generating..." : `Generate ${count} responses`}
        </button>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </aside>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            {candidates.length} candidates · {approvedCount} approved
          </p>
          <a
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold"
            href="/api/admin/content-lab/export"
          >
            Export approved CSV
          </a>
        </div>

        <div className="space-y-4">
          {candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              scenarioText={scenarioText}
              onDecide={decide}
              onMoreLikeThis={() => generate(candidate.response_text)}
            />
          ))}
          {!candidates.length ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-zinc-500">
              Choose a scenario and generate a batch.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function CandidateCard({
  candidate,
  scenarioText,
  onDecide,
  onMoreLikeThis,
}: {
  candidate: ContentCandidate;
  scenarioText: string;
  onDecide: (
    candidate: ContentCandidate,
    status: "approved" | "rejected" | "needs_edit",
    responseText?: string,
    rejectionReason?: string,
  ) => Promise<void>;
  onMoreLikeThis: () => void;
}) {
  const [text, setText] = useState(candidate.response_text);
  const [tests, setTests] = useState<ScenarioOption[]>([]);

  async function portabilityTest() {
    const response = await fetch("/api/admin/scenarios?random=3");
    const json = await response.json();
    setTests(json.scenarios ?? []);
  }

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">{scenarioText}—</p>
      <textarea
        className="mt-2 min-h-20 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-lg font-bold"
        maxLength={105}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
        <span>{text.length}/105</span>
        <span>{candidate.premise_attack}</span>
        <span>{candidate.portability} portability</span>
        <span>{candidate.spicy_level}</span>
        {candidate.duplicate_score >= 0.72 ? (
          <span className="text-amber-400">
            Similarity warning: {Math.round(candidate.duplicate_score * 100)}%
          </span>
        ) : null}
        {candidate.moderation_flagged ? (
          <span className="text-red-400">Moderation review</span>
        ) : null}
        <span className="font-bold uppercase">{candidate.status}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-black text-zinc-950"
          onClick={() => onDecide(candidate, "approved", text)}
          type="button"
        >
          Keep{candidate.response_text !== text ? " edit" : ""}
        </button>
        <button
          className="rounded-lg border border-red-800 px-3 py-2 text-sm font-bold text-red-300"
          onClick={() => onDecide(candidate, "rejected", text, "Rejected in Content Lab")}
          type="button"
        >
          Reject
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold"
          onClick={portabilityTest}
          type="button"
        >
          Test portability
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold"
          onClick={onMoreLikeThis}
          type="button"
        >
          More like this
        </button>
      </div>

      {tests.length ? (
        <div className="mt-4 space-y-2 rounded-xl bg-zinc-950 p-4 text-sm">
          {tests.map((test) => (
            <p key={test.id}>
              <span className="text-zinc-500">{test.text}—</span>{" "}
              <strong>{text}</strong>
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
