import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const YEAR_SECONDS = 31536000;
const MONTH_SECONDS = 2592000;

const nextConfig: NextConfig = {
  // Marketing pages are statically generated; keep them lean.
  images: {
    // The 4h default had every optimized image revalidating across the world several times a
    // day. Each of those round-trips costs ~1.9s while the server is far from the clinic.
    minimumCacheTTL: MONTH_SECONDS,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    return [
      {
        // Next serves `public/` with `max-age=0`, so every visit re-downloaded the hero video
        // and any directly referenced image in full.
        //
        // NOTE: `immutable` means replacing a file at the same path will never reach browsers
        // that already hold it. From here on, changed media needs a new filename.
        source: "/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: `public, max-age=${YEAR_SECONDS}, immutable`,
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
