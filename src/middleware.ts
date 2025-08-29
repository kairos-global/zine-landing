// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Only /dashboard is protected (later). Everything else just gets Clerk context.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ ok: false, error: { message: "Sign in required." } }, { status: 401 });
    }
  }
});

export const config = {
  matcher: [
    "/api/(.*)",       // run Clerk on API routes so auth/currentUser works
    "/dashboard(.*)",  // protected area
  ],
};
