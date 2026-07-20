"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import {
  generationRequestInputSchema,
  type GenerationRequestInput,
} from "@/domain/schemas";
import { DEMO_CAMPAIGN_NAME, DEMO_SCRIPT_AR } from "@/domain/demo-constants";
import { LANGUAGES, PLACEMENTS, PLATFORMS, PURPOSES } from "@/domain/types";
import {
  LANGUAGE_LABELS,
  PLACEMENT_LABELS,
  PLATFORM_LABELS,
  PURPOSE_LABELS,
  TERRITORY_OPTIONS,
  TOPIC_SUGGESTIONS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { submitRequestAction } from "@/server/actions";
import { GlassPanel } from "@/components/glass/GlassPanel";

export function GateForm({
  voice,
  hasActivePolicy,
  disabled,
}: {
  voice: { id: string; name: string; owner: string } | null;
  hasActivePolicy: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<GenerationRequestInput>({
    resolver: zodResolver(generationRequestInputSchema),
    defaultValues: {
      voiceId: voice?.id ?? "",
      script: DEMO_SCRIPT_AR,
      campaignName: DEMO_CAMPAIGN_NAME,
      purpose: "brand_promotion",
      platform: "instagram",
      language: "ar",
      placement: "organic",
      territory: "AE",
      publicationDate: "2026-07-25",
      topicTags: ["technology"],
    },
  });

  const placement = form.watch("placement");
  const topicTags = form.watch("topicTags");

  function toggleTopic(tag: string) {
    const current = form.getValues("topicTags");
    form.setValue(
      "topicTags",
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
      { shouldValidate: true },
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await submitRequestAction(values);
      if (result.ok) {
        router.push(`/gate?request=${result.data.requestId}`);
        router.refresh();
      } else {
        setServerError(result.error);
      }
    });
  });

  const fieldError = (name: keyof GenerationRequestInput) =>
    form.formState.errors[name]?.message as string | undefined;

  return (
    <GlassPanel eyebrow="Generation request" title="Request authorization" className="lg:sticky lg:top-8">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="voice" className="micro-label mb-1.5 block">
            Voice identity
          </label>
          <div id="voice" className="glass-inset flex items-center gap-3 px-3.5 py-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-informational-soft text-[12px] font-bold text-informational"
            >
              {voice?.owner.slice(0, 1) ?? "?"}
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold leading-tight text-text-primary">
                {voice?.name ?? "No voice available"}
              </p>
              <p className="text-[11.5px] leading-tight text-text-muted">
                owned by {voice?.owner ?? "—"} · via Kanban Studios
              </p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="script" className="micro-label mb-1.5 block">
            Script
          </label>
          <textarea
            id="script"
            rows={4}
            dir="auto"
            className="field resize-y leading-relaxed"
            aria-invalid={Boolean(fieldError("script"))}
            aria-describedby="script-note script-error"
            {...form.register("script")}
          />
          {fieldError("script") && (
            <p id="script-error" className="mt-1 text-[12px] text-blocked">
              {fieldError("script")}
            </p>
          )}
          <p id="script-note" className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-muted">
            <ShieldCheck className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            Script text is inert data. Instructions inside it can never influence
            authorization.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="col-span-2">
            <label htmlFor="campaignName" className="micro-label mb-1.5 block">
              Campaign
            </label>
            <input
              id="campaignName"
              type="text"
              className="field"
              aria-invalid={Boolean(fieldError("campaignName"))}
              {...form.register("campaignName")}
            />
            {fieldError("campaignName") && (
              <p className="mt-1 text-[12px] text-blocked">{fieldError("campaignName")}</p>
            )}
          </div>

          <SelectField
            id="purpose"
            label="Purpose"
            options={PURPOSES.map((value) => ({ value, label: PURPOSE_LABELS[value] }))}
            register={form.register("purpose")}
          />
          <SelectField
            id="platform"
            label="Platform"
            options={PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
            register={form.register("platform")}
          />
          <SelectField
            id="language"
            label="Language"
            options={LANGUAGES.map((value) => ({ value, label: LANGUAGE_LABELS[value] }))}
            register={form.register("language")}
          />
          <SelectField
            id="territory"
            label="Territory"
            options={TERRITORY_OPTIONS.map((entry) => ({
              value: entry.code,
              label: `${entry.label} (${entry.code})`,
            }))}
            register={form.register("territory")}
          />

          <div className="col-span-2">
            <span className="micro-label mb-1.5 block" id="placement-label">
              Placement
            </span>
            <div
              role="radiogroup"
              aria-labelledby="placement-label"
              className="grid grid-cols-2 gap-1 rounded-[11px] border border-border-glass bg-black/30 p-1"
            >
              {PLACEMENTS.map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-[38px] cursor-pointer items-center justify-center rounded-[8px] text-[13px] font-semibold transition-colors duration-150",
                    placement === value
                      ? value === "paid"
                        ? "border border-warning/40 bg-warning-soft text-warning"
                        : "border border-approved/35 bg-approved-soft text-approved"
                      : "border border-transparent text-text-muted hover:text-text-secondary",
                  )}
                >
                  <input
                    type="radio"
                    value={value}
                    className="sr-only"
                    data-testid={`placement-${value}`}
                    {...form.register("placement")}
                  />
                  {PLACEMENT_LABELS[value]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="publicationDate" className="micro-label mb-1.5 block">
              Publication date
            </label>
            <input
              id="publicationDate"
              type="date"
              className="field [color-scheme:dark]"
              aria-invalid={Boolean(fieldError("publicationDate"))}
              {...form.register("publicationDate")}
            />
          </div>

          <div>
            <span className="micro-label mb-1.5 block" id="topics-label">
              Topic tags
            </span>
            <div role="group" aria-labelledby="topics-label" className="flex flex-wrap gap-1.5">
              {TOPIC_SUGGESTIONS.map((tag) => {
                const active = topicTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    data-testid={`topic-${tag}`}
                    aria-pressed={active}
                    onClick={() => toggleTopic(tag)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11.5px] font-medium capitalize transition-colors duration-130",
                      active
                        ? tag === "politics"
                          ? "border-blocked/40 bg-blocked-soft text-blocked"
                          : "border-informational/35 bg-informational-soft text-informational"
                        : "border-border-glass bg-white/[0.03] text-text-muted hover:text-text-secondary",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {serverError && (
          <p role="alert" className="flex items-start gap-2 rounded-[10px] border border-blocked/30 bg-blocked-soft px-3 py-2.5 text-[12.5px] text-blocked">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {serverError}
          </p>
        )}

        <button
          type="submit"
          data-testid="submit-request"
          disabled={isPending || disabled || !hasActivePolicy || !voice}
          className="action-primary mt-1 w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Evaluating against policy…
            </>
          ) : (
            "Evaluate request"
          )}
        </button>
        {!hasActivePolicy && (
          <p className="text-center text-[12px] text-warning">
            No consent policy exists yet — the owner must approve one in the
            Consent Studio.
          </p>
        )}
      </form>
    </GlassPanel>
  );
}

function SelectField({
  id,
  label,
  options,
  register,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  register: object;
}) {
  return (
    <div>
      <label htmlFor={id} className="micro-label mb-1.5 block">
        {label}
      </label>
      <select id={id} className="field appearance-none" {...register}>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-background-elevated">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
