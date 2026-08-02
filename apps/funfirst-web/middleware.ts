import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  // Serve /battle-loco for battleloco.com root path
  if (
    (host === "battleloco.com" || host === "www.battleloco.com") &&
    request.nextUrl.pathname === "/"
  ) {
    return NextResponse.rewrite(new URL("/battle-loco", request.url));
  }
  // Serve /wrestle-loco for wrestleloco.com root path
  if (
    (host === "wrestleloco.com" || host === "www.wrestleloco.com") &&
    request.nextUrl.pathname === "/"
  ) {
    return NextResponse.rewrite(new URL("/wrestle-loco", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
