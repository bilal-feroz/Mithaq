/**
 * Public verification service.
 *
 * Exposes ONLY intentionally public facts about a generated asset:
 * that a registered consent policy existed, that this request was approved
 * under a specific policy version, and that this exact master file was
 * registered under that decision. It never claims legal identity or
 * universal legal consent.
 */
import QRCode from "qrcode";
import { sha256Hex } from "@/domain/hash";
import type { ClauseResult } from "@/domain/types";
import { getStore } from "@/server/data";
import { getEnv } from "@/server/env";

export type VerificationStatus = "active" | "expired" | "revoked";

export type PublicVerification = {
  verificationId: string;
  status: VerificationStatus;
  statusDetail: string;

  ownerDisplayName: string;
  voiceDisplayName: string;
  organizationName: string;

  purpose: string;
  platform: string;
  language: string;
  territory: string;
  placement: string;

  policyVersionUsed: number;
  currentPolicyVersion: number;
  currentPolicyStatus: string;
  revokedAt: string | null;

  approvedAt: string;
  generatedAt: string;

  assetSha256: string;
  assetMimeType: string;
  assetByteLength: number;
  provider: string;

  decisionTrail: {
    clause: string;
    status: ClauseResult["status"];
    code: string;
  }[];

  verifyUrl: string;
  qrDataUrl: string;
};

export async function getPublicVerification(
  verificationId: string,
): Promise<PublicVerification | null> {
  const store = getStore();
  const asset = await store.getAssetByVerificationId(verificationId);
  if (!asset) return null;

  const [decision, request, usedPolicy, currentPolicy] = await Promise.all([
    store.getDecision(asset.decisionId),
    store.getRequest(asset.requestId),
    store.getPolicy(asset.policyId),
    store.getLatestPolicyForVoice(asset.voiceId),
  ]);
  if (!decision || !request || !usedPolicy || !currentPolicy) return null;

  const [voice, organization] = await Promise.all([
    store.getVoice(asset.voiceId),
    store.getOrganization(asset.organizationId),
  ]);
  const owner = voice ? await store.getProfile(voice.ownerId) : null;

  const now = Date.now();
  let status: VerificationStatus = "active";
  let statusDetail =
    `A registered consent policy existed, this request was approved under policy version ${asset.policyVersion}, ` +
    `and this exact master file was registered under that decision. The policy is currently active.`;

  if (currentPolicy.status === "revoked" || usedPolicy.status === "revoked") {
    status = "revoked";
    const revokedAt = currentPolicy.revokedAt ?? usedPolicy.revokedAt;
    statusDetail =
      `Approved under policy version ${asset.policyVersion} on ${formatDate(decision.evaluatedAt)}. ` +
      `The owner revoked this policy${revokedAt ? ` on ${formatDate(revokedAt)}` : ""}. ` +
      `The historical approval record is preserved; no new use is authorized.`;
  } else if (
    currentPolicy.status === "expired" ||
    Date.parse(currentPolicy.validUntil) < now
  ) {
    status = "expired";
    statusDetail =
      `Approved under policy version ${asset.policyVersion} on ${formatDate(decision.evaluatedAt)}. ` +
      `The consent policy expired on ${formatDate(currentPolicy.validUntil)}; no new use is authorized.`;
  }

  const env = getEnv();
  const verifyUrl = `${env.appUrl}/verify/${asset.verificationId}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 168,
    color: { dark: "#0b0f15", light: "#f4f6f8" },
  });

  return {
    verificationId: asset.verificationId,
    status,
    statusDetail,
    ownerDisplayName: owner?.displayName ?? "Unknown owner",
    voiceDisplayName: voice?.displayName ?? "Unknown voice",
    organizationName: organization?.name ?? "Unknown organization",
    purpose: request.purpose,
    platform: request.platform,
    language: request.language,
    territory: request.territory,
    placement: request.placement,
    policyVersionUsed: asset.policyVersion,
    currentPolicyVersion: currentPolicy.version,
    currentPolicyStatus: currentPolicy.status,
    revokedAt: currentPolicy.revokedAt ?? usedPolicy.revokedAt,
    approvedAt: decision.evaluatedAt,
    generatedAt: asset.createdAt,
    assetSha256: asset.sha256,
    assetMimeType: asset.mimeType,
    assetByteLength: asset.byteLength,
    provider: asset.provider,
    decisionTrail: decision.clauses.map((clause) => ({
      clause: clause.clause,
      status: clause.status,
      code: clause.code,
    })),
    verifyUrl,
    qrDataUrl,
  };
}

export type FileComparison = {
  match: "exact" | "modified";
  uploadedSha256: string;
  registeredSha256: string;
};

/** Hash-compare an uploaded file against the registered master file. */
export async function compareUploadedFile(
  verificationId: string,
  bytes: Buffer,
): Promise<FileComparison | null> {
  const store = getStore();
  const asset = await store.getAssetByVerificationId(verificationId);
  if (!asset) return null;
  const uploadedSha256 = sha256Hex(bytes);
  return {
    match: uploadedSha256 === asset.sha256 ? "exact" : "modified",
    uploadedSha256,
    registeredSha256: asset.sha256,
  };
}

function formatDate(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return new Date(time).toISOString().slice(0, 10).replace(/-/g, "-");
}
