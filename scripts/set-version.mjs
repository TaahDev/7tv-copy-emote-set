// Set the app version in package.json, tauri.conf.json, and Cargo.toml.
// Usage: npm run set-version -- 0.2.0
import fs from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version || "")) {
  console.error("Usage: npm run set-version -- <semver>");
  console.error("Example: npm run set-version -- 0.2.0");
  process.exit(1);
}

function writeJson(path, mut) {
  const json = JSON.parse(fs.readFileSync(path, "utf8"));
  mut(json);
  fs.writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
}

writeJson("package.json", (j) => {
  j.version = version;
});
writeJson("src-tauri/tauri.conf.json", (j) => {
  j.version = version;
});

const cargoPath = "src-tauri/Cargo.toml";
const cargo = fs.readFileSync(cargoPath, "utf8");
let replaced = false;
const next = cargo.replace(/^version\s*=\s*"[^"]+"/m, (line) => {
  if (replaced) return line;
  replaced = true;
  return `version = "${version}"`;
});
if (!replaced) {
  console.error("Could not find a package version in src-tauri/Cargo.toml");
  process.exit(1);
}
fs.writeFileSync(cargoPath, next);

console.log(`Version set to ${version}`);
console.log("Next: add a ## [" + version + "] section in CHANGELOG.md, commit, and push main.");
