import "server-only";

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { runExternalApiAttempt } from "@/lib/external-api";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export async function uploadAdminImage(file: File) {
  const config = cloudinaryConfig();
  if (!config) throw new Error("cloudinary_not_configured");
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  const { value } = await runExternalApiAttempt({
    provider: "cloudinary",
    operation: "image.upload",
    requestMetadata: { bytes: buffer.byteLength, type: file.type, folder: "monebeauty/admin" },
    run: () => new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "image", folder: "monebeauty/admin", use_filename: true, unique_filename: true, overwrite: false, allowed_formats: ["jpg", "jpeg", "png", "webp", "avif", "gif"], tags: ["monebeauty-admin"] },
        (error, result) => {
          if (error || !result) reject(Object.assign(new Error(error?.message || "cloudinary_upload_failed"), { code: error?.http_code, status: error?.http_code }));
          else resolve(result);
        },
      );
      stream.end(buffer);
    }),
    responseMetadata: (result) => ({ publicId: result.public_id, format: result.format, bytes: result.bytes, width: result.width, height: result.height }),
  });
  return value;
}
