function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function createResponseCardsCsv(rows: Array<{ text: string; id: string; createdAt: string }>) {
  const headers = ["created_at", "text", "is_active", "id", "author_player_id", "author_name"];
  const body = rows.map((row) => [row.createdAt, row.text, false, row.id, "", "Admin Content Lab"]
    .map(csvEscape).join(","));
  return [headers.join(","), ...body].join("\n");
}
