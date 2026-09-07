import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { isUnprefixedAdminPath } from "./lib/admin-routing";
import { canonicalizeLegacyPublicPath } from "./lib/public-routes";

const localeMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Finnish admin routes have their own unprefixed App Router tree. Passing
  // them through next-intl rewrites `/admin` to `/fi/admin`, but the localized
  // admin tree intentionally only accepts EN and RU.
  if (isUnprefixedAdminPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const canonicalPath = canonicalizeLegacyPublicPath(request.nextUrl.pathname);
  if (canonicalPath) {
    const destination = request.nextUrl.clone();
    destination.pathname = canonicalPath;
    return NextResponse.redirect(destination, 308);
  }
  return localeMiddleware(request);
}

export const config = {
  // Localize public and admin routes; API, internals, and static files stay untouched.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
