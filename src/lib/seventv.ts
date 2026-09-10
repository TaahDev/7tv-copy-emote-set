// 7TV API client. Runs in the renderer (web + Tauri) so the token never
// leaves the user's machine. Ported from legacy/main.py with fixes:
// per-emote error reporting, timeouts, no trailing delay, cancellable.

export interface EmoteEntry {
  id: string;
  name: string;
}

export interface EmoteSet {
  id: string;
  name: string;
  emotes: EmoteEntry[];
}

export interface CopyProgress {
  done: number;
  total: number;
  currentChunk: number;
  totalChunks: number;
}

export interface CopyResult {
  copied: number;
  failed: { name: string; error: string }[];
}

const API = "https://7tv.io/v3";

const GQL_MUTATION = `mutation ChangeEmoteInSet($id: ObjectID!, $action: ListItemAction!, $emote_id: ObjectID!, $name: String) {
  emoteSet(id: $id) {
    id
    emotes(id: $emote_id, action: $action, name: $name) {
      id
      name
      __typename
    }
    __typename
  }
}`;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Accept a raw ID or a full 7tv.app URL and return the bare set ID. */
export function parseSetId(input: string): string {
  const v = input.trim();
  if (!v) return "";
  // e.g. https://7tv.app/emote-sets/01J...  -> take last path segment
  const m = v.match(/emote-sets\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  // bare ID (hex-ish, 24 chars historically)
  return v.split("/").pop()!.split("?")[0].trim();
}

export async function getEmoteSet(setId: string): Promise<EmoteSet> {
  const id = parseSetId(setId);
  if (!id) throw new Error("Enter a source emote set ID.");
  const res = await fetchWithTimeout(`${API}/emote-sets/${id}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Emote set not found. Check the source ID.");
    throw new Error(`Could not load emote set (HTTP ${res.status}).`);
  }
  const json = await res.json();
  const emotes: EmoteEntry[] = (json?.emotes ?? []).map((e: any) => ({
    id: e.id as string,
    name: e.name as string,
  }));
  return { id: json?.id ?? id, name: json?.name ?? "Untitled set", emotes };
}

interface GqlOp {
  operationName: "ChangeEmoteInSet";
  variables: { action: "ADD"; id: string; emote_id: string; name: string };
  query: string;
}

export async function copyEmotes(
  emotes: EmoteEntry[],
  targetSetId: string,
  token: string,
  opts: {
    chunkSize?: number;
    delayMs?: number;
    signal?: AbortSignal;
    onProgress?: (p: CopyProgress) => void;
  } = {},
): Promise<CopyResult> {
  const target = parseSetId(targetSetId);
  if (!target) throw new Error("Enter a target emote set ID.");
  const bearer = token.trim().replace(/^Bearer\s+/i, "");
  if (!bearer) throw new Error("Enter your 7TV bearer token.");

  const chunkSize = Math.min(Math.max(opts.chunkSize ?? 25, 1), 100);
  const delayMs = Math.max(opts.delayMs ?? 45_000, 0);
  const signal = opts.signal;

  const chunks: GqlOp[][] = [];
  for (let i = 0; i < emotes.length; i += chunkSize) {
    chunks.push(
      emotes.slice(i, i + chunkSize).map((e) => ({
        operationName: "ChangeEmoteInSet",
        variables: { action: "ADD", id: target, emote_id: e.id, name: e.name },
        query: GQL_MUTATION,
      })),
    );
  }

  const failed: { name: string; error: string }[] = [];
  let copied = 0;

  for (let ci = 0; ci < chunks.length; ci++) {
    signal?.throwIfAborted();
    const chunk = chunks[ci];
    const res = await fetchWithTimeout(
      `${API}/gql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify(chunk),
      },
      30_000,
    );
    if (res.status === 401 || res.status === 403) {
      throw new Error("Unauthorized — your token is invalid or expired.");
    }
    if (res.status === 429) {
      throw new Error("Rate limited by 7TV (429). Raise the delay and try again.");
    }
    if (!res.ok) throw new Error(`7TV rejected the batch (HTTP ${res.status}).`);

    // Batch endpoint returns an array aligned with the request; surface
    // per-emote errors instead of silently swallowing them (legacy bug).
    const body = await res.json();
    const arr = Array.isArray(body) ? body : [body];
    arr.forEach((item: any, i: number) => {
      const errs = item?.errors;
      if (errs?.length) {
        failed.push({
          name: chunk[i].variables.name,
          error: errs.map((e: any) => e.message).join("; "),
        });
      } else {
        copied += 1;
      }
    });

    opts.onProgress?.({
      done: Math.min(copied + failed.length, emotes.length),
      total: emotes.length,
      currentChunk: ci + 1,
      totalChunks: chunks.length,
    });

    // No trailing delay after the final chunk (legacy bug fix).
    if (delayMs > 0 && ci < chunks.length - 1) {
      await sleep(delayMs, signal);
    }
  }

  return { copied, failed };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
