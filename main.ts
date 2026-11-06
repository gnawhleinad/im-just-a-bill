import { email } from "https://esm.town/v/std/email";
import { getSeenLaws, recordSeenLaws } from "./db.ts";
import {
  BillType,
  getBillSummary,
  getCurrentCongress,
  getLaws,
} from "./congress.ts";
import * as cheerio from "npm:cheerio";

function htmlToText(html: string): string {
  const $ = cheerio.load(html);

  // Remove elements that shouldn't appear in plain text.
  $("script, style, noscript").remove();

  // Preserve paragraph and list formatting.
  $("br").replaceWith("\n");
  $("p, div, h1, h2, h3, h4, h5, h6").append("\n");
  $("li").prepend("• ").append("\n");

  return $.text()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default async function (interval: Interval) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const congress = await getCurrentCongress();

  const bufferDays = 3;

  const daysFromNow = new Date(today);
  daysFromNow.setDate(today.getDate() - bufferDays);

  const minDate = [
    daysFromNow.getFullYear(),
    String(daysFromNow.getMonth() + 1).padStart(2, "0"),
    String(daysFromNow.getDate()).padStart(2, "0"),
  ].join("-");

  console.log(
    `searching for current congress (${congress}) with target dates (${minDate} - ${targetDate})...`,
  );

  const laws = await getLaws(congress, today, targetDate, bufferDays);

  console.log(`found ${laws.length} laws!`);

  const seenLaws = await getSeenLaws();

  const seenKeys = new Set(
    seenLaws.map(
      (law) => `${law.congress}-${law.type}-${law.number}`,
    ),
  );

  const newLaws = laws.filter((law) => {
    const key = `${law.congress}-${law.type.toLowerCase()}-${law.number}`;

    return !seenKeys.has(key);
  });

  console.log(`with seen, there are ${newLaws.length} new laws...`);

  if (newLaws.length > 0) {
    const text = await Promise.all(
      newLaws.map(async (law) => {
        const summary = await getBillSummary(
          law.congress,
          law.type.toLowerCase() as BillType,
          law.number,
        );

        return [
          `${law.congress}-${law.type}-${law.number}: ${law.title}`,
          "",
          htmlToText(summary),
        ].join("\n");
      }),
    );

    await email({
      subject: `[im-just-a-bill] ${minDate} - ${targetDate}`,
      text: text.join("\n\n"),
    });

    await recordSeenLaws(newLaws);
  }
}