export const MAX_ADMIN_IMAGE_BYTES = 25 * 1024 * 1024;

export const ADMIN_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export function isLocalMediaReference(reference: string) {
  return reference.startsWith("/media/") && !reference.includes("..");
}

export function isCloudinaryMediaReference(
  reference: string,
  cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim(),
) {
  if (!cloudName) return false;
  try {
    const url = new URL(reference);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith(`/${cloudName}/image/upload/`)
    );
  } catch {
    return false;
  }
}

export function isAllowedMediaReference(reference: string) {
  return (
    isLocalMediaReference(reference) || isCloudinaryMediaReference(reference)
  );
}

export function singleImageReference(
  rawReference: string,
  { required = true }: { required?: boolean } = {},
) {
  const reference = rawReference.trim();
  const references = reference
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (references.length === 0) {
    if (required) throw new Error("image_required");
    return null;
  }
  if (references.length !== 1 || !isAllowedMediaReference(references[0]))
    throw new Error("invalid_media_reference");
  return references[0];
}
