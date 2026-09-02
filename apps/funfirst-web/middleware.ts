import { NextResponse } from "next/server";
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/signin", "/signin/(.*)"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const host = request.headers.get("host") ?? "";
    if (
      (host === "battleloco.com" || host === "www.battleloco.com") &&
      request.nextUrl.pathname === "/"
    ) {
      return NextResponse.rewrite(new URL("/battle-loco", request.url));
    }
    if (
      (host === "wrestleloco.com" || host === "www.wrestleloco.com") &&
      request.nextUrl.pathname === "/"
    ) {
      return NextResponse.rewrite(new URL("/wrestle-loco", request.url));
    }
    if (
      (host === "comedyloco.com" || host === "www.comedyloco.com") &&
      request.nextUrl.pathname === "/"
    ) {
      return NextResponse.rewrite(new URL("/comedy-loco", request.url));
    }

    // Clean branded URLs: strip the slug prefix on known format routes so
    // battleloco.com/performances serves /battle-loco/performances, etc.
    // Physical /{slug}/* routes, /locos, and shared app routes pass through
    // untouched, so legacy links keep working.
    const brandSlugs: Record<string, string> = {
      "battleloco.com": "battle-loco",
      "www.battleloco.com": "battle-loco",
      "wrestleloco.com": "wrestle-loco",
      "www.wrestleloco.com": "wrestle-loco",
      "comedyloco.com": "comedy-loco",
      "www.comedyloco.com": "comedy-loco",
    };
    const strippedSegments = [
      "performances",
      "performance",
      "games",
      "designer",
      "player",
    ];
    const brandSlug = brandSlugs[host];
    if (brandSlug && request.nextUrl.pathname !== "/") {
      // Legacy slug URLs on branded hosts: redirect to the clean route so the
      // address bar stays consistent (308 preserves method + query string).
      if (request.nextUrl.pathname === `/${brandSlug}`) {
        return NextResponse.redirect(new URL("/", request.url), 308);
      }
      if (request.nextUrl.pathname.startsWith(`/${brandSlug}/`)) {
        return NextResponse.redirect(
          new URL(
            request.nextUrl.pathname.slice(brandSlug.length + 1) +
              request.nextUrl.search,
            request.url,
          ),
          308,
        );
      }
      const segment = request.nextUrl.pathname.split("/")[1] ?? "";
      if (strippedSegments.includes(segment)) {
        return NextResponse.rewrite(
          new URL(
            `/${brandSlug}${request.nextUrl.pathname}${request.nextUrl.search}`,
            request.url,
          ),
        );
      }
    }

    if (isSignInPage(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/");
    }
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
