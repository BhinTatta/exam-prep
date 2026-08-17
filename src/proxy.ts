import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe: built directly from authConfig (no Prisma adapter) so this
// never bundles Node-only code. Named "proxy" per the Next.js 16 convention
// (successor to "middleware").
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/admin/:path*", "/mentor/dashboard/:path*", "/moderator/:path*"],
};
