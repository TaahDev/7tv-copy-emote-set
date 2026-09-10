import { useMemo, useRef, useState } from "react";
import {
  copyEmotes,
  getEmoteSet,
  parseSetId,
  type CopyProgress,
  type EmoteSet,
} from "./lib/seventv";

type Phase = "idle" | "copying" | "done" | "error";
type LogLine = { kind: "info" | "ok" | "err"; text: string };

const DEFAULT_CHUNK = 25;
const DEFAULT_DELAY_S = 45;

export default function App() {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("s7v.token") ?? "");
  const [showToken, setShowToken] = useState(false);
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK);
  const [delayS, setDelayS] = useState(DEFAULT_DELAY_S);

  const [phase, setPhase] = useState<Phase>("idle");
  const [set, setSet] = useState<EmoteSet | null>(null);
  const [progress, setProgress] = useState<CopyProgress | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [failures, setFailures] = useState<{ name: string; error: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const busy = phase === "copying";
  const pct = useMemo(() => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.done / progress.total) * 100);
  }, [progress]);

  const push = (kind: LogLine["kind"], text: string) =>
    setLog((l) => [...l.slice(-199), { kind, text }]);

  function persistToken(v: string) {
    setToken(v);
    try {
      if (v.trim()) localStorage.setItem("s7v.token", v.trim());
      else localStorage.removeItem("s7v.token");
    } catch {
      /* private mode */
    }
  }

  async function start() {
    if (busy) return;
    setFailures([]);
    setSummary("");
    setProgress(null);
    try {
      let emotes = set?.emotes ?? [];
      if (!emotes.length || parseSetId(source) !== set?.id) {
        push("info", "Loading source set…");
        const s = await getEmoteSet(source);
        setSet(s);
        emotes = s.emotes;
        push("ok", `Found “${s.name}” — ${s.emotes.length} emotes.`);
      }
      if (emotes.length === 0) throw new Error("Source set is empty — nothing to copy.");
      if (!parseSetId(target)) throw new Error("Enter a target emote set ID.");
      if (!token.trim()) throw new Error("Enter your 7TV bearer token.");

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setPhase("copying");
      const chunks = Math.ceil(emotes.length / chunkSize);
      push("info", `Copying ${emotes.length} emotes in ${chunks} batches…`);

      const res = await copyEmotes(emotes, target, token, {
        chunkSize,
        delayMs: delayS * 1000,
        signal: ctrl.signal,
        onProgress: (p) => {
          setProgress(p);
          push("info", `Batch ${p.currentChunk}/${p.totalChunks} — ${p.done}/${p.total} done.`);
        },
      });
      setPhase("done");
      setFailures(res.failed);
      const msg =
        res.failed.length === 0
          ? `Done — ${res.copied}/${emotes.length} emotes copied.`
          : `Finished with ${res.failed.length} failures — ${res.copied}/${emotes.length} copied.`;
      setSummary(msg);
      push(res.failed.length ? "err" : "ok", msg);
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setPhase("idle");
        push("info", "Cancelled.");
        setSummary("Cancelled.");
      } else {
        setPhase("error");
        const msg = String(e?.message ?? e);
        push("err", msg);
        setSummary(msg);
      }
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  return (
    <div className="page">
      <main className="shell">
        <h1 className="hero">Copy any 7TV set.</h1>

        <section className="card" aria-label="Emote copier">
          <Field
            label="Source"
            value={source}
            onChange={setSource}
            placeholder="Set ID or https://7tv.app/emote-sets/…"
            hint={set ? `${set.name} · ${set.emotes.length} emotes` : undefined}
          />
          <Field
            label="Destination"
            value={target}
            onChange={setTarget}
            placeholder="Your set ID or URL"
          />
          <div className="field">
            <div className="row">
              <label htmlFor="token">Token</label>
              <button
                type="button"
                className="link"
                onClick={() => setShowToken((s) => !s)}
                aria-label={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => persistToken(e.target.value)}
              placeholder="7TV bearer token"
              autoComplete="off"
              spellCheck={false}
            />
            <details className="token-guide">
              <summary>How to get a token</summary>
              <ol>
                <li>Sign in at <a href="https://7tv.app" target="_blank" rel="noreferrer">7tv.app</a>.</li>
                <li>Open DevTools with <kbd>F12</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>, then open the <strong>Network</strong> tab.</li>
                <li>Browse any emote set so a request named <code>gql</code> shows up.</li>
                <li>
                  Click it → <strong>Headers</strong> → scroll down to <strong>Authorization</strong>, and copy the
                  value after <code>Bearer</code>. It always starts with <code>ey</code>.
                </li>
              </ol>
              <p className="token-guide-note">Saved only on this device. It is sent to 7TV, nowhere else.</p>
            </details>
          </div>

          <div className="grid2">
            <div className="field">
              <label htmlFor="chunk">Batch size</label>
              <div className="stepper">
                <button type="button" onClick={() => setChunkSize((c) => Math.max(1, c - 5))} disabled={busy} aria-label="Decrease batch size">−</button>
                <input
                  id="chunk"
                  inputMode="numeric"
                  value={chunkSize}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!Number.isNaN(n)) setChunkSize(Math.min(100, Math.max(1, n)));
                    else if (e.target.value === "") setChunkSize(1);
                  }}
                  disabled={busy}
                />
                <button type="button" onClick={() => setChunkSize((c) => Math.min(100, c + 5))} disabled={busy} aria-label="Increase batch size">+</button>
              </div>
            </div>
            <div className="field">
              <div className="row">
                <label htmlFor="delay">Delay between batches</label>
                <span className="value">{delayS}s</span>
              </div>
              <input
                id="delay"
                type="range"
                min={5}
                max={120}
                step={1}
                value={delayS}
                onChange={(e) => setDelayS(Number(e.target.value))}
                disabled={busy}
              />
              <p className="hint">Higher = safer against 7TV rate limits.</p>
            </div>
          </div>

          {/* Progress */}
          {(phase === "copying" || progress) && (
            <div className="progress" role="status">
              <div className="row">
                <span>
                  {progress ? `Batch ${progress.currentChunk}/${progress.totalChunks}` : "Working…"}
                </span>
                <span className="value">{pct}%</span>
              </div>
              <div className="bar">
                <div className="fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {summary && (
            <p className={`summary ${phase === "error" ? "err" : phase === "done" ? "ok" : ""}`}>
              {summary}
            </p>
          )}

          <div className="actions">
            {phase === "copying" ? (
              <button className="btn danger" onClick={cancel}>Cancel</button>
            ) : (
              <button className="btn primary" onClick={start} disabled={busy}>
                Start copying
              </button>
            )}
          </div>

          {set && set.emotes.length > 0 && (
            <div className="preview">
              <p className="preview-title">Source preview · first {Math.min(24, set.emotes.length)}</p>
              <div className="chips">
                {set.emotes.slice(0, 24).map((e) => (
                  <span className="chip" key={e.id} title={e.id}>{e.name}</span>
                ))}
                {set.emotes.length > 24 && <span className="chip more">+{set.emotes.length - 24} more</span>}
              </div>
            </div>
          )}

          {failures.length > 0 && (
            <details className="failures">
              <summary>{failures.length} emotes failed — show details</summary>
              <ul>
                {failures.slice(0, 50).map((f) => (
                  <li key={f.name}><code>{f.name}</code> — {f.error}</li>
                ))}
              </ul>
            </details>
          )}

          {log.length > 0 && (
            <div className="console" aria-label="Log">
              {log.slice(-8).map((l, i) => (
                <p key={i} className={`line ${l.kind}`}>{l.text}</p>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  const id = `f-${props.label}`;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      {props.hint && <p className="hint">{props.hint}</p>}
    </div>
  );
}
