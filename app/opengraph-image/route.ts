import { createElement } from "react";
import { ImageResponse } from "next/og";
import { BrandedOpenGraphCard } from "@/components/seo/BrandedOpenGraphCard";

export async function GET() {
  return new ImageResponse(createElement(BrandedOpenGraphCard), {
    width: 1200,
    height: 630,
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
