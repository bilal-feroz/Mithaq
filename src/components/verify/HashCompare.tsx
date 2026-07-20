"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { cn, shortHash } from "@/lib/utils";
import { SecurityLabel } from "@/components/glass/SecurityLabel";

type CompareResult = {
  match: "exact" | "modified";
  uploadedSha256: string;
  registeredSha256: string;
};

/**
 * Exact-file verification: hashes an uploaded file server-side and compares
 * it with the registered master. We never claim to know WHAT changed — only
 * whether the bytes are identical.
 */
export function HashCompare({ verificationId }: { verificationId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function compare(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/verify/${verificationId}/compare`, {
        method: "POST",
        body,
      });
      const json = (await response.json()) as CompareResult & { error?: string };
      if (!response.ok) {
        setError(json.error ?? "Comparison failed.");
      } else {
        setResult(json);
      }
    } catch {
      setError("Comparison failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass-panel p-6" aria-label="Exact file match check">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SecurityLabel>Exact-file match check</SecurityLabel>
          <p className="mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-text-secondary">
            Upload a file you received. Its SHA-256 is compared with the
            registered master — the file itself is never stored.
          </p>
        </div>
        <label className={cn("action-quiet cursor-pointer", busy && "pointer-events-none opacity-60")}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden />
          )}
          {busy ? "Hashing…" : "Choose audio file"}
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.wav,.mp3"
            className="sr-only"
            data-testid="compare-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void compare(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[12.5px] text-blocked">
          {error}
        </p>
      )}

      {result && (
        <div
          data-testid="compare-result"
          data-match={result.match}
          aria-live="polite"
          className={cn(
            "mt-4 flex items-start gap-3 rounded-[12px] border px-4 py-3.5",
            result.match === "exact"
              ? "border-approved/35 bg-approved-soft"
              : "border-warning/40 bg-warning-soft",
          )}
        >
          {result.match === "exact" ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-approved" strokeWidth={1.9} aria-hidden />
          ) : (
            <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-warning" strokeWidth={1.9} aria-hidden />
          )}
          <div className="min-w-0">
            <p
              className={cn(
                "text-[14px] font-bold",
                result.match === "exact" ? "text-approved" : "text-warning",
              )}
            >
              {result.match === "exact"
                ? "Exact match — this is the registered master file"
                : "Modified — not byte-identical to the registered master"}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
              {fileName && <span className="text-text-primary">{fileName}</span>}{" "}
              · uploaded {shortHash(result.uploadedSha256, 14)} vs registered{" "}
              {shortHash(result.registeredSha256, 14)}
            </p>
            {result.match === "modified" && (
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-muted">
                MITHAQ cannot determine what changed. Note that public platforms
                re-encode uploads, which alters the hash even when the content
                sounds identical.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
