// Pull the CHANGELOG.md section for a version into a file for GitHub Releases.
// Usage: node scripts/extract-release-notes.mjs 0.2.0 release-notes.md
import fs from "node:fs";

const version = process.argv[2];
const outPath = process.argv[3] || "release-notes.md";

if (!version) {
  console.error("Usage: node scripts/extract-release-notes.mjs <version> [outfile]");
  process.exit(1);
}

const changelogPath = "CHANGELOG.md";
if (!fs.existsSync(changelogPath)) {
  console.error("CHANGELOG.md is missing. Add patch notes before publishing.");
  process.exit(1);
}

const text = fs.readFileSync(changelogPath, "utf8").replace(/\r\n/g, "\n");
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const heading = new RegExp(`^## \\[?${escaped}\\]?[^\\n]*$`, "m");
const match = heading.exec(text);

if (!match) {
  console.error(
    `No CHANGELOG.md section for ${version}. Add a heading like:\n\n## [${version}] - YYYY-MM-DD\n\n### Added\n- Your patch notes here.\n`,
  );
  process.exit(1);
}

const start = match.index + match[0].length;
const rest = text.slice(start);
const next = rest.search(/^## /m);
const body = (next === -1 ? rest : rest.slice(0, next)).trim();

if (!body) {
  console.error(`CHANGELOG.md section for ${version} is empty. Add patch notes under that heading.`);
  process.exit(1);
}

fs.writeFileSync(outPath, `${body}\n`);
console.log(`Wrote ${outPath} (${body.length} chars)`);
