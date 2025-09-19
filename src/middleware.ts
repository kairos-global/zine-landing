// src/middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

// 👇 Define which routes are protected by Clerk
export const config = {
  matcher: [
    "/api/:path*",
    "/zinemat",         // base route
    "/zinemat/:path*",  // nested routes
    "/dashboard",       // base route
    "/dashboard/:path*",// nested routes
  ],
}