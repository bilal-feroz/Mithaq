/**
 * Display labels for normalized enum values and reason codes.
 * The engine compares normalized values; the UI speaks human.
 */
import type { Language, Placement, Platform, Purpose } from "@/domain/types";
import { REASON_CODE_MESSAGES, type ReasonCode } from "@/domain/reason-codes";

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  website: "Website",
  other: "Other",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  ar: "Arabic",
  en: "English",
  ur: "Urdu",
  other: "Other",
};

export const PURPOSE_LABELS: Record<Purpose, string> = {
  brand_promotion: "Brand promotion",
  education: "Education",
  internal_training: "Internal training",
  entertainment: "Entertainment",
  public_service: "Public service",
  other: "Other",
};

export const PLACEMENT_LABELS: Record<Placement, string> = {
  organic: "Organic",
  paid: "Paid",
};

export const TERRITORY_OPTIONS: { code: string; label: string }[] = [
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "KW", label: "Kuwait" },
  { code: "QA", label: "Qatar" },
  { code: "BH", label: "Bahrain" },
  { code: "OM", label: "Oman" },
  { code: "EG", label: "Egypt" },
  { code: "JO", label: "Jordan" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
];

export function territoryLabel(code: string): string {
  return TERRITORY_OPTIONS.find((entry) => entry.code === code)?.label ?? code;
}

export function reasonCodeMessage(code: string): string {
  if (code in REASON_CODE_MESSAGES) {
    return REASON_CODE_MESSAGES[code as ReasonCode];
  }
  return code.replaceAll("_", " ").toLowerCase();
}

export const TOPIC_SUGGESTIONS = [
  "technology",
  "fashion",
  "food",
  "travel",
  "sports",
  "finance",
  "politics",
  "health",
] as const;
