// src/middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

// 👇 Define which routes are protected by Clerk
export const config = {
  matcher: [
    "/api/:path*",       // protect all API routes (includes /api/zinemat/submit)
    "/zinemat/:path*",   // protect zinemat pages
    "/dashboard/:path*", // protect dashboard pages
  ],
};
