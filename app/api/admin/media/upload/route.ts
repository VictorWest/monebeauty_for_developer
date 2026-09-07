import { NextResponse } from "next/server";
import { uploadAdminImage } from "@/lib/cloudinary";
import { audit, requireApiUser } from "@/lib/auth";
import {
  ADMIN_IMAGE_MIME_TYPES,
  MAX_ADMIN_IMAGE_BYTES,
} from "@/lib/media-reference";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (file.size > MAX_ADMIN_IMAGE_BYTES)
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  if (!(ADMIN_IMAGE_MIME_TYPES as readonly string[]).includes(file.type))
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });

  try {
    const uploaded = await uploadAdminImage(file);
    void audit({
      actor: user.email,
      action: "media_uploaded",
      entity: "MediaAsset",
      entityId: uploaded.public_id,
    }).catch(() => undefined);
    return NextResponse.json({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      width: uploaded.width,
      height: uploaded.height,
      format: uploaded.format,
      bytes: uploaded.bytes,
    });
  } catch (error) {
    const unavailable =
      error instanceof Error && error.message === "cloudinary_not_configured";
    return NextResponse.json(
      { error: unavailable ? "upload_unavailable" : "upload_failed" },
      { status: unavailable ? 503 : 502 },
    );
  }
}
