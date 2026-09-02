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
      (host === "homeshow.com" || host === "www.homeshow.com") &&
      request.nextUrl.pathname === "/"
    ) {
      return NextResponse.rewrite(new URL("/homeshow", request.url));
    }
    if (
      (host === "weddingloco.com" || host === "www.weddingloco.com") &&
      request.nextUrl.pathname === "/"
    ) {
      return NextResponse.rewrite(new URL("/wedding-loco", request.url));
    }
    if (
      (host === "barloco.com" || host === "www.barloco.com") &&
      request.nextUrl.pathname === "/"
    ) {
      return NextResponse.rewrite(new URL("/bar-loco", request.url));
    }

    // Clean branded URLs: strip the slug prefix on known format routes so
    // homeshow.com/performances serves /homeshow/performances, barloco.com/games
    // serves /bar-loco/games, etc. Physical /{slug}/* routes, /locos, and shared
    // app routes pass through untouched, so legacy links keep working.
    const brandSlugs: Record<string, string> = {
      "homeshow.com": "homeshow",
      "www.homeshow.com": "homeshow",
      "barloco.com": "bar-loco",
      "www.barloco.com": "bar-loco",
    };
    const weddingHosts = ["weddingloco.com", "www.weddingloco.com"];
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
    if (weddingHosts.includes(host) && request.nextUrl.pathname !== "/") {
      // Legacy physical wedding routes on the branded host: redirect to the
      // clean segment route so the address bar stays consistent.
      if (request.nextUrl.pathname === "/wedding-loco") {
        return NextResponse.redirect(new URL("/", request.url), 308);
      }
      const weddingCleanMap: Record<string, string> = {
        "wedding-ceremony": "ceremony",
        "wedding-reception": "reception",
      };
      const segment = request.nextUrl.pathname.split("/")[1] ?? "";
      if (weddingCleanMap[segment]) {
        return NextResponse.redirect(
          new URL(
            `/${weddingCleanMap[segment]}${request.nextUrl.pathname.slice(segment.length + 1)}${request.nextUrl.search}`,
            request.url,
          ),
          308,
        );
      }
      if (segment === "ceremony" || segment === "reception") {
        return NextResponse.rewrite(
          new URL(
            `/wedding-${segment}${request.nextUrl.pathname.slice(segment.length + 1)}${request.nextUrl.search}`,
            request.url,
          ),
        );
      }
      if (strippedSegments.includes(segment)) {
        // weddingloco.com defaults to the reception card (mirrors the legacy
        // /wedding-loco/* redirects).
        return NextResponse.rewrite(
          new URL(
            `/wedding-reception${request.nextUrl.pathname}${request.nextUrl.search}`,
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
