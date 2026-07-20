"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { DEMO_CONSENT_STATEMENT } from "@/domain/demo-constants";
import type { ExtractionResult } from "@/domain/schemas";
import { LANGUAGES, PLATFORMS, PURPOSES, type Language } from "@/domain/types";
import {
  LANGUAGE_LABELS,
  PLATFORM_LABELS,
  PURPOSE_LABELS,
  TERRITORY_OPTIONS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { approvePolicyAction, extractConsentAction } from "@/server/actions";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Reveal } from "@/components/glass/Reveal";
import { SecurityLabel } from "@/components/glass/SecurityLabel";
import { ConsentRecorder } from "./ConsentRecorder";

type Stage = "capture" | "review" | "issued";

type ReviewState = {
  organizationIds: string[];
  purposes: string[];
  platforms: string[];
  languages: string[];
  territories: string[];
  paidAdvertising: "allowed" | "prohibited";
  editingAllowed: boolean;
  maximumAssets: number;
  validUntil: string;
  prohibitedTopics: string[];
};

export function StudioFlow({
  voice,
  organizations,
  challengePhrase,
  existingPolicyVersion,
  aiProvider,
  isOwner,
}: {
  voice: { id: string; name: string } | null;
  organizations: { id: string; name: string }[];
  challengePhrase: string;
  existingPolicyVersion: number | null;
  aiProvider: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("capture");
  const [consentText, setConsentText] = useState(DEMO_CONSENT_STATEMENT);
  const [language, setLanguage] = useState<Language>("en");
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [adapterName, setAdapterName] = useState<string>("");
  const [review, setReview] = useState<ReviewState | null>(null);
  const [issuedVersion, setIssuedVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runExtraction() {
    if (!voice) return;
    setError(null);
    startTransition(async () => {
      const result = await extractConsentAction({
        consentText,
        language,
        voiceId: voice.id,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const draft = result.data.result.draft;
      setExtraction(result.data.result);
      setAdapterName(result.data.adapterName);
      setReview({
        organizationIds: organizations
          .filter((org) =>
            draft.authorizedOrganizationNames.some(
              (name) => name.toLowerCase() === org.name.toLowerCase(),
            ),
          )
          .map((org) => org.id),
        purposes: draft.allowedPurposes,
        platforms: draft.allowedPlatforms,
        languages: draft.allowedLanguages,
        territories: draft.allowedTerritories.length > 0 ? draft.allowedTerritories : [],
        paidAdvertising: draft.paidAdvertising ?? "prohibited",
        editingAllowed: false,
        maximumAssets: draft.maximumAssets ?? 1,
        validUntil: draft.validUntil ? draft.validUntil.slice(0, 10) : "2026-07-30",
        prohibitedTopics: draft.prohibitedTopics,
      });
      setStage("review");
    });
  }

  function approve() {
    if (!voice || !review) return;
    setError(null);
    startTransition(async () => {
      const result = await approvePolicyAction({
        voiceId: voice.id,
        authorizedOrganizationIds: review.organizationIds,
        allowedPurposes: review.purposes as never,
        allowedPlatforms: review.platforms as never,
        allowedLanguages: review.languages as never,
        allowedTerritories: review.territories,
        paidAdvertising: review.paidAdvertising,
        editingAllowed: review.editingAllowed,
        maximumAssets: review.maximumAssets,
        validUntil: `${review.validUntil}T23:59:59.000Z`,
        prohibitedTopics: review.prohibitedTopics,
        sourceConsentText: consentText,
        sourceConsentLanguage: language,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIssuedVersion(result.data.version);
      setStage("issued");
      router.refresh();
    });
  }

  const toggle = (key: keyof ReviewState, value: string) => {
    setReview((current) => {
      if (!current) return current;
      const list = current[key] as string[];
      return {
        ...current,
        [key]: list.includes(value)
          ? list.filter((entry) => entry !== value)
          : [...list, value],
      };
    });
  };

  if (stage === "issued") {
    return (
      <Reveal className="mt-8">
        <section className="glass-strong halo-approved light-sweep mx-auto max-w-[640px] p-8 text-center" aria-live="polite">
          <CheckCircle2 className="mx-auto h-10 w-10 text-approved" strokeWidth={1.6} aria-hidden />
          <h2 className="display mt-4 text-[22px] font-bold text-text-primary">
            Policy version {issuedVersion} is active
          </h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-text-secondary">
            Your structured consent terms are now the single source of truth the
            deterministic engine enforces on every generation request.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Link href="/console" className="action-primary">
              Open Owner Console
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/gate" className="action-quiet">
              View the Generation Gate
            </Link>
          </div>
        </section>
      </Reveal>
    );
  }

  return (
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-12">
      {/* capture column */}
      <Reveal delay={0.05} className="lg:col-span-5">
        <GlassPanel eyebrow="Step 1" title="Dynamic consent challenge" className="lg:sticky lg:top-8">
          <p className="text-[12.5px] leading-relaxed text-text-secondary">
            Read this server-generated phrase aloud while recording — it ties
            the capture to this moment. It is a consent record, not biometric
            verification.
          </p>
          <p
            data-testid="challenge-phrase"
            className="forensic mt-3 rounded-[12px] border border-informational/25 bg-informational-soft px-4 py-3.5 text-center text-[15px] font-medium tracking-wide text-informational"
          >
            “{challengePhrase}”
          </p>

          <ConsentRecorder />

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="consent-text" className="micro-label">
                Consent statement (text fallback)
              </label>
              <div role="radiogroup" aria-label="Statement language" className="flex gap-1 rounded-[8px] border border-border-glass bg-black/30 p-0.5">
                {(["en", "ar"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={language === value}
                    onClick={() => setLanguage(value)}
                    className={cn(
                      "rounded-[6px] px-2.5 py-1 text-[11.5px] font-semibold uppercase",
                      language === value
                        ? "bg-white/[0.09] text-text-primary"
                        : "text-text-muted hover:text-text-secondary",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              id="consent-text"
              rows={6}
              dir={language === "ar" ? "rtl" : "ltr"}
              lang={language === "ar" ? "ar" : "en"}
              value={consentText}
              onChange={(event) => setConsentText(event.target.value)}
              className="field resize-y leading-relaxed"
            />
            <p className="mt-1.5 text-[11px] text-text-muted">
              Demo mode extracts from this text. With an AI key configured, the
              recording is transcribed first.
            </p>
          </div>

          {error && stage === "capture" && (
            <p role="alert" className="mt-3 text-[12.5px] text-blocked">{error}</p>
          )}

          <button
            type="button"
            data-testid="extract-terms"
            disabled={isPending || !isOwner || !voice || consentText.trim().length < 10}
            onClick={runExtraction}
            className="action-primary mt-5 w-full"
          >
            {isPending && stage === "capture" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Extracting terms…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                Extract structured terms
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-text-muted">
            extraction adapter: {aiProvider === "mock" ? "deterministic demo extractor" : aiProvider}
          </p>
        </GlassPanel>
      </Reveal>

      {/* review column */}
      <div className="lg:col-span-7">
        {stage === "capture" || !review || !extraction ? (
          <Reveal delay={0.1}>
            <div className="glass-panel flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
              <Wand2 className="h-8 w-8 text-text-muted" strokeWidth={1.4} aria-hidden />
              <p className="mt-4 max-w-[38ch] text-[13.5px] leading-relaxed text-text-muted">
                Extracted terms appear here as a structured policy passport —
                with anything missing or ambiguous flagged for your decision.
              </p>
            </div>
          </Reveal>
        ) : (
          <Reveal>
            <GlassPanel
              eyebrow="Step 2 — review & approve"
              title="Structured policy passport"
              action={
                <SecurityLabel>
                  extracted by {adapterName || "adapter"} · not yet enforceable
                </SecurityLabel>
              }
            >
              {(extraction.missingFields.length > 0 ||
                extraction.ambiguousFields.length > 0) && (
                <div className="glass-subtle mb-5 border-warning/30 bg-warning-soft/40 p-4">
                  <p className="flex items-center gap-2 text-[12.5px] font-semibold text-warning">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    Needs your decision
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {extraction.missingFields.map((field) => (
                      <li key={field} className="text-[12.5px] text-text-secondary">
                        <span className="forensic text-warning">{field}</span> — not
                        stated in the consent; set it below.
                      </li>
                    ))}
                    {extraction.ambiguousFields.map((entry) => (
                      <li key={entry.field} className="text-[12.5px] text-text-secondary">
                        <span className="forensic text-warning">{entry.field}</span> —{" "}
                        {entry.note}
                      </li>
                    ))}
                  </ul>
                  {extraction.clarificationQuestions.length > 0 && (
                    <div className="mt-3 border-t border-warning/20 pt-3">
                      {extraction.clarificationQuestions.map((question) => (
                        <p key={question} className="flex items-start gap-2 text-[12.5px] italic text-text-secondary">
                          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                          {question}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-5">
                <ToggleGroup
                  label="Authorized organizations"
                  options={organizations.map((org) => ({ value: org.id, label: org.name }))}
                  selected={review.organizationIds}
                  onToggle={(value) => toggle("organizationIds", value)}
                />
                <ToggleGroup
                  label="Purposes"
                  options={PURPOSES.map((p) => ({ value: p, label: PURPOSE_LABELS[p] }))}
                  selected={review.purposes}
                  onToggle={(value) => toggle("purposes", value)}
                />
                <ToggleGroup
                  label="Platforms"
                  options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] }))}
                  selected={review.platforms}
                  onToggle={(value) => toggle("platforms", value)}
                />
                <ToggleGroup
                  label="Languages"
                  options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
                  selected={review.languages}
                  onToggle={(value) => toggle("languages", value)}
                />
                <ToggleGroup
                  label="Territories"
                  options={TERRITORY_OPTIONS.slice(0, 8).map((t) => ({
                    value: t.code,
                    label: `${t.label}`,
                  }))}
                  selected={review.territories}
                  onToggle={(value) => toggle("territories", value)}
                  warn={review.territories.length === 0}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="micro-label mb-1.5 block">Paid advertising</span>
                    <div className="grid grid-cols-2 gap-1 rounded-[11px] border border-border-glass bg-black/30 p-1">
                      {(["prohibited", "allowed"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={review.paidAdvertising === value}
                          onClick={() =>
                            setReview((c) => c && { ...c, paidAdvertising: value })
                          }
                          className={cn(
                            "min-h-[38px] rounded-[8px] text-[12.5px] font-semibold capitalize",
                            review.paidAdvertising === value
                              ? value === "prohibited"
                                ? "border border-warning/40 bg-warning-soft text-warning"
                                : "border border-approved/35 bg-approved-soft text-approved"
                              : "text-text-muted hover:text-text-secondary",
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="micro-label mb-1.5 block">Editing of audio</span>
                    <div className="grid grid-cols-2 gap-1 rounded-[11px] border border-border-glass bg-black/30 p-1">
                      {[
                        { value: false, label: "Not allowed" },
                        { value: true, label: "Light edits" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          aria-pressed={review.editingAllowed === option.value}
                          onClick={() =>
                            setReview((c) => c && { ...c, editingAllowed: option.value })
                          }
                          className={cn(
                            "min-h-[38px] rounded-[8px] text-[12.5px] font-semibold",
                            review.editingAllowed === option.value
                              ? "border border-informational/35 bg-informational-soft text-informational"
                              : "text-text-muted hover:text-text-secondary",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="max-assets" className="micro-label mb-1.5 block">
                      Maximum assets
                    </label>
                    <input
                      id="max-assets"
                      type="number"
                      min={1}
                      max={100}
                      value={review.maximumAssets}
                      onChange={(event) =>
                        setReview(
                          (c) => c && { ...c, maximumAssets: Number(event.target.value) || 1 },
                        )
                      }
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor="valid-until" className="micro-label mb-1.5 block">
                      Valid until
                    </label>
                    <input
                      id="valid-until"
                      type="date"
                      value={review.validUntil}
                      onChange={(event) =>
                        setReview((c) => c && { ...c, validUntil: event.target.value })
                      }
                      className="field [color-scheme:dark]"
                    />
                  </div>
                </div>

                <ToggleGroup
                  label="Prohibited topics (explicit prohibitions override permissions)"
                  options={["politics", "religion", "gambling", "alcohol"].map((t) => ({
                    value: t,
                    label: t,
                  }))}
                  selected={review.prohibitedTopics}
                  onToggle={(value) => toggle("prohibitedTopics", value)}
                  tone="blocked"
                />
              </div>

              {error && stage === "review" && (
                <p role="alert" className="mt-4 text-[12.5px] text-blocked">{error}</p>
              )}

              {existingPolicyVersion !== null && (
                <p className="mt-5 rounded-[10px] border border-informational/25 bg-informational-soft px-3.5 py-2.5 text-[12.5px] text-text-secondary">
                  An active policy v{existingPolicyVersion} exists. Approving
                  issues <strong className="text-text-primary">version {existingPolicyVersion + 1}</strong>,
                  superseding it — history is preserved, never rewritten.
                </p>
              )}

              <button
                type="button"
                data-testid="approve-policy"
                disabled={
                  isPending ||
                  !isOwner ||
                  review.organizationIds.length === 0 ||
                  review.purposes.length === 0 ||
                  review.platforms.length === 0 ||
                  review.languages.length === 0 ||
                  review.territories.length === 0
                }
                onClick={approve}
                className="action-primary mt-5 w-full"
              >
                {isPending && stage === "review" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Issuing policy…
                  </>
                ) : (
                  "I approve these exact terms — activate policy"
                )}
              </button>
              <p className="mt-2 text-center text-[11px] text-text-muted">
                Only this approved structure is enforced. The AI draft carries no
                authority.
              </p>
            </GlassPanel>
          </Reveal>
        )}
      </div>
    </div>
  );
}

function ToggleGroup({
  label,
  options,
  selected,
  onToggle,
  tone = "informational",
  warn = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  tone?: "informational" | "blocked";
  warn?: boolean;
}) {
  return (
    <div>
      <span className={cn("micro-label mb-1.5 block", warn && "text-warning")}>
        {label}
        {warn && " — required"}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              data-testid={`term-${option.value}`}
              onClick={() => onToggle(option.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors duration-130",
                active
                  ? tone === "blocked"
                    ? "border-blocked/40 bg-blocked-soft text-blocked"
                    : "border-informational/35 bg-informational-soft text-informational"
                  : "border-border-glass bg-white/[0.03] text-text-muted hover:text-text-secondary",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
