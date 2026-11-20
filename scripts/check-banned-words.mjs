/**
 * Fails if a BESS-optimiser brand appears outside the README competitor table.
 * The table is the only place those names are allowed. Entrix is on the list
 * and is not in that table, so it must not appear anywhere.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

const BANNED = [
  "entrix",
  "enspired",
  "suena",
  "statkraft",
  "quadra",
  "terralayr",
  "trlyr",
  "modoenergy",
  "modo energy",
  "habitat energy",
  "flexitricity",
  "krakenflex",
  "gridbeyond",
  "arenko",
  "gridmatic",
  "openenergi",
  "autobidder",
];

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "out",
  "dist",
  "playwright-report",
  "test-results",
  "coverage",
  "lib/mock/data",
]);

const ALLOW_FILES = new Set(["scripts/check-banned-words.mjs"]);

const TEXT = /\.(md|mdx|txt|ts|tsx|js|mjs|cjs|json|yml|yaml|css|html|svg)$/i;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const rel = relative(ROOT, path);
    if (SKIP_DIRS.has(rel)) continue;
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else if (TEXT.test(name)) out.push(path);
  }
  return out;
}

function stripCompetitorTable(markdown) {
  const start = markdown.indexOf("## Competitor landscape");
  if (start < 0) return markdown;
  const after = markdown.indexOf("\n## ", start + 4);
  const end = after < 0 ? markdown.length : after;
  return markdown.slice(0, start) + markdown.slice(end);
}

const hits = [];
for (const file of walk(ROOT, [])) {
  const rel = relative(ROOT, file);
  if (ALLOW_FILES.has(rel)) continue;
  let text = readFileSync(file, "utf8");
  if (rel === "README.md") text = stripCompetitorTable(text);
  const lower = text.toLowerCase();
  for (const word of BANNED) {
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) {
      const line = lower.split("\n").findIndex((l) => re.test(l)) + 1;
      hits.push(`${rel}:${line}: ${word}`);
    }
  }
}

if (hits.length) {
  console.error("Banned optimiser names found outside the README competitor table:");
  for (const hit of hits) console.error("  " + hit);
  process.exit(1);
}

console.log("Banned-name check passed.");
