"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Browser audio recording for the dynamic consent challenge, with graceful
 * degradation: when MediaRecorder or microphone permission is unavailable the
 * text fallback below remains the consent source. The recording is kept
 * locally as part of the capture experience; demo mode does not transcribe.
 */
export function ConsentRecorder() {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof window.MediaRecorder !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    );
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setAudioUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone unavailable — use the text statement below instead.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  if (!supported) {
    return (
      <p className="mt-4 rounded-[10px] border border-border-glass bg-black/25 px-3.5 py-2.5 text-[12px] text-text-muted">
        Audio recording is not supported in this browser — the text statement
        below serves as your consent capture.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-[12px] border border-border-glass bg-black/25 p-3.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={recording ? stop : start}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors",
            recording
              ? "border-blocked/50 bg-blocked-soft text-blocked"
              : "border-border-glass-strong bg-white/[0.06] text-text-primary hover:bg-white/[0.1]",
          )}
        >
          {recording ? (
            <Square className="h-4 w-4 fill-current" aria-hidden />
          ) : (
            <Mic className="h-4.5 w-4.5" strokeWidth={1.9} aria-hidden />
          )}
        </button>
        <div className="min-w-0 flex-1">
          {recording ? (
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                <span className="absolute h-full w-full animate-ping rounded-full bg-blocked/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-blocked" />
              </span>
              <p className="text-[13px] font-medium text-text-primary">
                Recording the challenge… {String(Math.floor(seconds / 60)).padStart(1, "0")}:
                {String(seconds % 60).padStart(2, "0")}
              </p>
            </div>
          ) : audioUrl ? (
            <p className="text-[12.5px] text-text-secondary">
              Recording captured — kept with your consent record.
            </p>
          ) : (
            <p className="text-[12.5px] text-text-muted">
              Record yourself reading the phrase (optional in demo mode).
            </p>
          )}
        </div>
      </div>
      {audioUrl && !recording && (
        <audio
          controls
          src={audioUrl}
          aria-label="Your consent recording"
          className="mt-3 w-full"
        />
      )}
      {error && <p className="mt-2 text-[12px] text-warning">{error}</p>}
    </div>
  );
}
