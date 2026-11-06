import { sqlite } from "https://esm.town/v/std/sqlite/main.ts";
import { Law } from "./congress.ts";

await sqlite.execute(`
  CREATE TABLE IF NOT EXISTS seen (
    congress INTEGER NOT NULL,
    type TEXT NOT NULL,
    number INTEGER NOT NULL,
    emailed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (congress, type, number)
  )
`);

interface Seen {
  congress: number;
  type: string;
  number: number;
}

export async function getSeenLaws(): Promise<Seen[]> {
  const result = await sqlite.execute(`
    SELECT congress, type, number
    FROM seen
  `);

  return result.rows.map((row) => ({
    congress: Number(row.congress),
    type: String(row.type),
    number: Number(row.number),
  }));
}

export async function recordSeenLaws(laws: Law[]): Promise<void> {
  await sqlite.batch(
    laws.map((law) => ({
      sql: `
        INSERT OR IGNORE INTO seen (congress, type, number)
        VALUES (?, ?, ?)
      `,
      args: [
        law.congress,
        law.type.toLowerCase(),
        law.number,
      ],
    })),
  );
}