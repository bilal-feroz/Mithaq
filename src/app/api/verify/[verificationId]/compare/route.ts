import { NextRequest, NextResponse } from "next/server";
import { compareUploadedFile } from "@/server/services/verification";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["audio/", "video/", "application/octet-stream"];

/**
 * Public hash comparison: hashes the uploaded file and compares it with the
 * registered master. The upload is never stored; only its SHA-256 is used.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ verificationId: string }> },
) {
  const { verificationId } = await context.params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File must be between 1 byte and 25 MB" },
      { status: 413 },
    );
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    return NextResponse.json(
      { error: "Only audio files can be compared" },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await compareUploadedFile(verificationId, bytes);
  if (!result) {
    return NextResponse.json({ error: "Verification not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
