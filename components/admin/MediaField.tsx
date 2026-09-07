"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { useAdminFormActivity } from "@/components/admin/AdminForm";
import {
  ADMIN_IMAGE_MIME_TYPES,
  MAX_ADMIN_IMAGE_BYTES,
} from "@/lib/media-reference";

export function MediaField({
  name,
  label,
  defaultValue = "",
  required = true,
  focalXName,
  focalYName,
  defaultFocalX = 50,
  defaultFocalY = 50,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  focalXName?: string;
  focalYName?: string;
  defaultFocalX?: number;
  defaultFocalY?: number;
}) {
  const [path, setPath] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [showRequiredError, setShowRequiredError] = useState(false);
  const [focalX, setFocalX] = useState(defaultFocalX);
  const [focalY, setFocalY] = useState(defaultFocalY);
  const uploadId = useId();
  const fieldId = useId();
  const pathRef = useRef(path);
  const t = useTranslations("Admin.media");
  const { pending } = useFormStatus();
  const { registerImageField, setUploadActive } = useAdminFormActivity();

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(
    () =>
      registerImageField(fieldId, {
        validate: () => !required || Boolean(pathRef.current),
        showRequiredError: () => setShowRequiredError(true),
      }),
    [fieldId, registerImageField, required],
  );

  function requestUpload(file: File) {
    return new Promise<string>((resolve, reject) => {
      const body = new FormData();
      body.set("file", file);
      const request = new XMLHttpRequest();
      request.open("POST", "/api/admin/media/upload");
      request.responseType = "json";
      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        setUploadProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
      });
      request.upload.addEventListener("load", () => {
        setUploadProgress(100);
        setProcessing(true);
      });
      request.addEventListener("load", () => {
        const result = request.response as { url?: string } | null;
        if (request.status < 200 || request.status >= 300 || !result?.url) {
          reject(new Error("upload_failed"));
          return;
        }
        resolve(result.url);
      });
      request.addEventListener("error", () =>
        reject(new Error("upload_failed")),
      );
      request.addEventListener("abort", () =>
        reject(new Error("upload_aborted")),
      );
      request.send(body);
    });
  }

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadMessage("");
    setShowRequiredError(false);
    if (!(ADMIN_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setUploadMessage(t("typeError"));
      return;
    }
    if (file.size > MAX_ADMIN_IMAGE_BYTES) {
      setUploadMessage(t("sizeError"));
      return;
    }

    setUploading(true);
    setProcessing(false);
    setUploadProgress(0);
    setUploadActive(fieldId, true);
    try {
      const uploaded = await requestUpload(file);
      setPath(uploaded);
      setUploadMessage(t("success"));
    } catch {
      setUploadMessage(t("uploadError"));
    } finally {
      setUploading(false);
      setProcessing(false);
      setUploadActive(fieldId, false);
    }
  }

  return (
    <div>
      <span className="mb-[6px] block font-sans text-label tracking-[.08em] text-muted uppercase">
        {label}
      </span>
      <input type="hidden" name={name} value={path} />
      {path ? (
        <div className="relative aspect-[16/9] max-h-[280px] overflow-hidden rounded-[6px] border border-line-card bg-page">
          <Image
            src={path}
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
            style={{ objectPosition: `${focalX}% ${focalY}%` }}
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] max-h-[220px] items-center justify-center rounded-[6px] border border-dashed border-line-btn bg-page px-[18px] text-center font-sans text-[13px] text-muted">
          {required ? t("requiredImage") : t("changeImage")}
        </div>
      )}
      <div className="mt-[8px] flex flex-wrap items-center gap-[10px]">
        <input
          id={uploadId}
          type="file"
          accept={ADMIN_IMAGE_MIME_TYPES.join(",")}
          disabled={uploading || pending}
          className="peer sr-only"
          onChange={(event) => {
            void upload(event.target.files);
            event.target.value = "";
          }}
        />
        <label
          htmlFor={uploadId}
          className={`inline-flex min-h-[44px] items-center justify-center rounded-[4px] border border-line-btn bg-card px-[13px] font-sans text-meta tracking-[.08em] text-ink uppercase peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 ${uploading || pending ? "pointer-events-none opacity-60" : "cursor-pointer hover:bg-btn-fill"}`}
        >
          {uploading
            ? t("uploadProgress", { percent: uploadProgress })
            : t("changeImage")}
        </label>
        {!required && path ? (
          <button
            type="button"
            disabled={uploading || pending}
            onClick={() => {
              setPath("");
              setUploadMessage("");
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[4px] border border-line-btn bg-card px-[13px] font-sans text-meta tracking-[.08em] text-ink uppercase hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("removeImage")}
          </button>
        ) : null}
        <span aria-live="polite" className="font-sans text-[12px] text-muted">
          {processing ? t("processing") : uploadMessage}
        </span>
      </div>
      {showRequiredError && required && !path ? (
        <p role="alert" className="mt-[7px] font-sans text-[12px] text-red-700">
          {t("requiredImage")}
        </p>
      ) : null}
      {focalXName && focalYName ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="font-sans text-label text-muted">
            <span className="mb-1 block">Horizontal focus · {focalX}%</span>
            <input
              name={focalXName}
              type="range"
              min="0"
              max="100"
              value={focalX}
              onChange={(event) => setFocalX(Number(event.target.value))}
              className="w-full accent-(--color-accent)"
            />
          </label>
          <label className="font-sans text-label text-muted">
            <span className="mb-1 block">Vertical focus · {focalY}%</span>
            <input
              name={focalYName}
              type="range"
              min="0"
              max="100"
              value={focalY}
              onChange={(event) => setFocalY(Number(event.target.value))}
              className="w-full accent-(--color-accent)"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
