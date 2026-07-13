export function normalizeCardText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(value: string): string[] {
  const normalized = normalizeCardText(value).replace(/\s/g, "_");
  if (normalized.length < 2) return [normalized];
  return Array.from({ length: normalized.length - 1 }, (_, index) =>
    normalized.slice(index, index + 2),
  );
}

export function diceSimilarity(a: string, b: string): number {
  const aa = bigrams(a);
  const bb = bigrams(b);
  const counts = new Map<string, number>();
  for (const gram of aa) counts.set(gram, (counts.get(gram) ?? 0) + 1);

  let overlap = 0;
  for (const gram of bb) {
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  }

  return (2 * overlap) / Math.max(1, aa.length + bb.length);
}

export function findClosestDuplicate(
  candidate: string,
  existing: string[],
): { score: number; text: string | null } {
  let bestScore = 0;
  let bestText: string | null = null;
  const normalizedCandidate = normalizeCardText(candidate);

  for (const item of existing) {
    const normalizedItem = normalizeCardText(item);
    const score =
      normalizedCandidate === normalizedItem ? 1 : diceSimilarity(candidate, item);
    if (score > bestScore) {
      bestScore = score;
      bestText = item;
    }
  }

  return { score: Number(bestScore.toFixed(4)), text: bestText };
}
