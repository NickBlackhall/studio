import { createResponseCardsCsv } from "@/lib/content-lab/csv";
import { findClosestDuplicate, normalizeCardText } from "@/lib/content-lab/similarity";

describe("Content Lab utilities", () => {
  it("normalizes punctuation and accents for exact duplicate checks", () => {
    expect(normalizeCardText("Bút—why?!")).toBe("but why");
    expect(findClosestDuplicate("But why?", ["but why!", "something else"]).score).toBe(1);
  });

  it("exports inactive response cards with CSV-safe text", () => {
    const csv = createResponseCardsCsv([{ text: 'but it says "no, thanks."', id: "card-id", createdAt: "2026-07-13T00:00:00.000Z" }]);
    expect(csv).toContain('"but it says ""no, thanks."""');
    expect(csv).toContain('"false"');
    expect(csv).toContain('"Admin Content Lab"');
  });
});
