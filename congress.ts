import { isWithinPreviousDays } from "./util.ts";

type CurrentCongressResponse = {
  congress: {
    number: number;
    name: string;
    startYear: string;
    endYear: string;
  };
};

export async function getCurrentCongress(): Promise<number> {
  const apiKey = process.env.CONGRESS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing CONGRESS_API_KEY");
  }

  const url = new URL(
    "https://api.congress.gov/v3/congress/current",
  );
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Congress.gov API error: ${response.status}`);
  }

  const data = (await response.json()) as CurrentCongressResponse;

  return data.congress.number;
}

export type Law = {
  congress: number;
  type: string;
  number: number;
  title: string;
  latestAction?: {
    actionDate?: string;
    text?: string;
  };
  url: string;
};

type CongressLawResponse = {
  pagination: {
    count: number;
    next?: string;
  };
  request: {
    contentType: string;
  };
  bills: Law[];
};

export async function getLaws(
  congress: number,
  today: Date,
  targetDate: string,
  bufferDays: number,
): Promise<Law[]> {
  const apiKey = process.env.CONGRESS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing CONGRESS_API_KEY environment variable");
  }

  const laws: Law[] = [];
  let offset = 0;
  const limit = 250;

  while (true) {
    const url = new URL(
      `https://api.congress.gov/v3/law/${congress}`,
    );

    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Congress.gov API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as CongressLawResponse;
    laws.push(...(data.bills ?? []));

    if (laws.length >= data.pagination.count || !data.bills?.length) {
      break;
    }

    offset += limit;
  }

  return laws.filter(
    (law) =>
      law.latestAction?.actionDate &&
      isWithinPreviousDays(law.latestAction.actionDate, today, bufferDays) &&
      law.latestAction?.text?.includes("Became Public Law"),
  );
}

export type BillType =
  | "hr"
  | "s"
  | "hjres"
  | "sjres"
  | "hconres"
  | "sconres"
  | "hres"
  | "sres";

interface BillSummary {
  actionDate: string;
  actionDesc: string;
  text: string;
  updateDate: string;
  versionCode: string;
}

interface BillSummariesResponse {
  summaries?: BillSummary[];
}

export async function getBillSummary(
  congress: number,
  billType: BillType,
  billNumber: number,
): Promise<string> {
  const apiKey = process.env.CONGRESS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing CONGRESS_API_KEY environment variable");
  }

  const url = new URL(
    `https://api.congress.gov/v3/bill/${congress}/${billType}/${billNumber}/summaries`,
  );

  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Congress.gov API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as BillSummariesResponse;

  if (!data.summaries?.length) {
    return "No official summary is currently available for this bill.";
  }

  // Get the most recently updated summary.
  const latestSummary = data.summaries.sort(
    (a, b) =>
      new Date(b.updateDate).getTime() -
      new Date(a.updateDate).getTime(),
  )[0];

  return latestSummary.text;
}