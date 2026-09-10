<p align="center">
  <img src="app-icon.png" alt="7TV Emote Copier" width="120" height="120">
</p>

<h1 align="center">7TV Emote Copier</h1>

<p align="center">
  Copy any <a href="https://7tv.app">7TV</a> emote set in one click.<br>
  Free, open source, and your token never leaves your device.
</p>

<p align="center">
  <a href="https://github.com/TaahDev/7tv-copy-emote-set/releases/latest"><img src="https://img.shields.io/github/v/release/TaahDev/7tv-copy-emote-set?style=flat-square" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/TaahDev/7tv-copy-emote-set?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/platform-Windows-0078D4?style=flat-square" alt="Windows">
</p>

---

Paste a source set, pick your destination, and copy in safe batches. Built as a small Windows desktop app — no account, no cloud proxy, no extra 7TV login flow.

## Features

- Copy a full emote set from a URL or set ID
- Preview the source before you start
- Batched copies with a delay so 7TV rate limits are less likely to trip
- Per-emote errors instead of a silent “it worked”
- Cancel anytime
- Token stays on this device (saved only in local app storage)

## Download

Windows only. No Rust or Node install needed to use the app.

- **Latest version:** [Releases](https://github.com/TaahDev/7tv-copy-emote-set/releases/latest) — portable `.exe` or installer
- **Older versions:** the same [Releases](https://github.com/TaahDev/7tv-copy-emote-set/releases) page keeps every previous `v*` (they are not overwritten)

Grab the installer if you want a Start Menu entry, or the portable `.exe` if you just want to run it.

## Usage

1. Download and open **7TV Emote Copier**.
2. **Source** — a set ID or URL like `https://7tv.app/emote-sets/…`
3. **Destination** — the set you own (or can edit). Same ID or URL format.
4. **Token** — your 7TV bearer token (see below).
5. Optionally hit **Preview source**, then **Start copying**.

Default pace is 25 emotes per batch with 45 seconds between batches. Raise the delay if you get rate-limited (HTTP 429).

### Getting your token

1. Open [7tv.app](https://7tv.app) and sign in.
2. Open DevTools → **Network**.
3. Trigger any GraphQL request (browse a set, edit something).
4. Find a `gql` request → **Request Headers** → `Authorization: Bearer …`
5. Paste that token into the app.

It is stored only in this app’s localStorage. It is never sent anywhere except 7TV.

## How it works

1. `GET https://7tv.io/v3/emote-sets/{source}` → emote list
2. Batched `POST https://7tv.io/v3/gql` with `ChangeEmoteInSet(ADD)` mutations
3. Default 25 per batch + 45s delay to respect 7TV rate limits
4. Per-emote errors surfaced (401/403/429 handled with friendly messages)
5. Cancellable via `AbortController` — no trailing delay after the final batch

All logic: [`src/lib/seventv.ts`](src/lib/seventv.ts). UI: [`src/App.tsx`](src/App.tsx).

## Development

```sh
npm install
npm run dev
```

Then open http://localhost:1420. Production desktop builds need [Tauri’s prerequisites](https://v2.tauri.app/start/prerequisites/) and `npx tauri build`.

## License

[MIT](LICENSE)
