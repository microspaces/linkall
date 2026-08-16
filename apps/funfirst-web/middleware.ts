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

    if (isSignInPage(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/");
    }
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
