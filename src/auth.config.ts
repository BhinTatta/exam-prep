import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe config: used by middleware. No Prisma adapter and no Node-only
// providers here — those live in src/auth.ts (server/route-handler only).
export const authConfig = {
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Lets a pre-seeded admin row (created by prisma/seed.ts, no OAuth
      // account attached yet) link up on first Google sign-in by email.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const protectedPrefixes = ["/admin", "/mentor/dashboard", "/moderator"];
      const needsAuth = protectedPrefixes.some((p) => path.startsWith(p));
      if (!needsAuth) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
