// Fetches the ScienceDaily "Stem Cells" RSS feed and writes a trimmed news.json.
// Zero dependencies; run with Node >= 20 (global fetch). Invoked by the GitHub
// Action in .github/workflows/news.yml on a schedule.

import { writeFileSync } from "node:fs";

const FEED = "https://www.sciencedaily.com/rss/health_medicine/stem_cells.xml";
const MAX_ITEMS = 8;

const res = await fetch(FEED, {
  headers: { "user-agent": "stemcells-referral-news/1.0 (+static site news feed)" },
});
if (!res.ok) {
  console.error(`Feed fetch failed: HTTP ${res.status}`);
  process.exit(1);
}
const xml = await res.text();

const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);

const pickTag = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1] : "";
};
const unwrapCdata = (s) => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
const clean = (s) =>
  decodeEntities(unwrapCdata(s).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

const items = [];
for (const block of blocks) {
  const title = clean(pickTag(block, "title"));
  const link = clean(pickTag(block, "link"));
  const pubDate = clean(pickTag(block, "pubDate"));
  if (!title || !/^https?:\/\//i.test(link)) continue;

  let date = "";
  const d = new Date(pubDate);
  if (!Number.isNaN(d.getTime())) date = d.toISOString();

  items.push({ title, link, date });
  if (items.length >= MAX_ITEMS) break;
}

if (items.length === 0) {
  console.error("No items parsed from feed — leaving news.json untouched.");
  process.exit(1);
}

const payload = {
  source: "ScienceDaily",
  sourceUrl: "https://www.sciencedaily.com/news/health_medicine/stem_cells/",
  feed: FEED,
  updated: new Date().toISOString(),
  items,
};

writeFileSync("news.json", JSON.stringify(payload, null, 2) + "\n");
console.log(`Wrote news.json with ${items.length} items.`);
