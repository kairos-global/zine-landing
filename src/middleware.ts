import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isLoggedIn = request.cookies.get("__session"); // Clerk uses this

  const path = request.nextUrl.pathname;

  const isProtected =
    path.startsWith("/zinemat") ||
    path.startsWith("/dashboard");

  if (isProtected && !isLoggedIn) {
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("redirect_url", path);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/zinemat/:path*", "/dashboard/:path*"],
};
