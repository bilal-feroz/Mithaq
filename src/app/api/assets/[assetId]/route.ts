import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/server/data";
import { getSession } from "@/server/session";

/**
 * Streams a generated master asset to an authenticated demo persona.
 * Public verification never exposes the audio — only its hash.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await context.params;

  const session = await getSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const store = getStore();
  const asset = await store.getAsset(assetId);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
  // Owners see assets for their voices; requesters see their organization's.
  if (session.role === "requester") {
    if (asset.organizationId !== session.organization?.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else {
    const voice = await store.getVoice(asset.voiceId);
    if (voice?.ownerId !== session.profile.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  const bytes = await store.getAssetBytes(assetId);
  if (!bytes) {
    return NextResponse.json(
      { error: "Asset bytes unavailable" },
      { status: 404 },
    );
  }

  const extension = asset.mimeType === "audio/mpeg" ? "mp3" : "wav";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": `inline; filename="mithaq-${asset.id}.${extension}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
