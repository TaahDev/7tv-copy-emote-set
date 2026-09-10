# 7TV Emote Copier

Copy any 7TV emote set in one click. Apple-minimal desktop app built with **Tauri + React + TypeScript**.

> Free & open source (MIT). Your bearer token never leaves your device.

## Why this rewrite?

The original `legacy/` Python + Tkinter version worked, but had real issues:

- checked only HTTP 200, silently swallowing per-emote GraphQL errors
- slept the full delay even after the last batch
- `requests` with no timeouts — could hang forever
- Tkinter widgets updated from a background thread (crash-prone)
- Tkinter UI felt dated, hard to distribute

This version fixes all of that, with a Linear / Apple-style UI.

## Quick start (web dev mode — no Rust needed)

```sh
npm install
npm run dev
```

Open http://localhost:1420.

## Production build

```sh
npm run build   # typecheck + vite build -> dist/
npm run preview # serve dist/ locally
```

## Download

No Rust install needed on your machine:

- **Latest version:** repo → **Releases** → newest `v*` → portable `.exe` or installer.
- **Older versions:** the same Releases page keeps every previous `v*` (they are not overwritten).
- **PR / CI artifacts:** repo → **Actions** → a workflow run → **Artifacts**
  (these expire; use Releases for anything you want to keep).

## Ship a new version (maintainers)

You pick the version number. Pushing `main` builds Windows binaries and publishes
a GitHub Release for that version. Older releases stay on the Releases page.

1. **Set the version** (updates `package.json`, `src-tauri/tauri.conf.json`, and `Cargo.toml`):

   ```sh
   npm run set-version -- 0.2.0
   ```

2. **Write patch notes** at the top of [`CHANGELOG.md`](CHANGELOG.md). The heading
   must match the version exactly:

   ```md
   ## [0.2.0] - 2026-09-10

   ### Added
   - What is new.

   ### Fixed
   - What you fixed.
   ```

3. **Commit and push `main`:**

   ```sh
   git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md
   git commit -m "Release 0.2.0"
   git push origin main
   ```

4. Wait for **Actions → Build & Release**. It creates (or updates) tag `v0.2.0`
   and a GitHub Release with your notes plus the `.exe` / installers.

**Rules**

- All three version fields must match, or CI fails.
- `CHANGELOG.md` must have a non-empty `## [x.y.z]` section for that version, or the publish step fails.
- Bump the version for a **new** historized release. Pushing the same version again rebuilds and updates that release only; previous `v*` releases are left alone.
- Pull requests build artifacts but do **not** publish a release.

## Build locally (optional)

Requires Rust + platform webview deps — see
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Most people
should just use CI (see above).

```sh
npm run build
npx tauri build
```

Binaries land in `src-tauri/target/release/bundle/`.

## How it works

1. `GET https://7tv.io/v3/emote-sets/{source}` → emote list
2. Batched `POST https://7tv.io/v3/gql` with `ChangeEmoteInSet(ADD)` mutations
3. Default 25 per batch + 45s delay to respect 7TV rate limits
4. Per-emote errors surfaced (401/403/429 handled with friendly messages)
5. Cancellable via `AbortController` — no trailing delay after the final batch

All logic: [`src/lib/seventv.ts`](src/lib/seventv.ts). UI: [`src/App.tsx`](src/App.tsx).

## Getting your inputs

- **Source / Destination:** a set ID or full URL like `https://7tv.app/emote-sets/…`
- **Token:** your 7TV bearer token (7tv.app → devtools → network → `gql` → `Authorization: Bearer …`).
  Stored only in app localStorage.

## Project layout

```
src/            React UI + 7TV client
src-tauri/      Tauri shell (window, bundling — no secrets, no proxy)
scripts/        icon generator + set-version / release-notes helpers
legacy/         original Python/Tkinter version (gitignored, not published)
.github/        build on PR; Release on every push to main
CHANGELOG.md    patch notes used as GitHub Release body
```

## Contributing

PRs welcome. `npm run build` must pass. Keep the UI type-first and minimal —
one blue accent, no decoration.

## License

MIT — see [LICENSE](LICENSE).
