import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyTelegramAuth, type TelegramAuthPayload } from "@/lib/telegram";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: {
        payload: { label: "Telegram payload", type: "text" },
      },
      async authorize(credentials) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken || typeof credentials?.payload !== "string") return null;

        let payload: TelegramAuthPayload;
        try {
          payload = JSON.parse(credentials.payload);
        } catch {
          return null;
        }

        if (!verifyTelegramAuth(payload, botToken)) return null;

        const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim();

        const user = await prisma.user.upsert({
          where: { telegramId: payload.id },
          update: {
            name: name || undefined,
            image: payload.photo_url ?? undefined,
          },
          create: {
            telegramId: payload.id,
            name: name || payload.username || `tg_${payload.id}`,
            image: payload.photo_url,
          },
        });

        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Refresh role from DB on every session read so admin/mod promotions
    // take effect without waiting for the JWT to expire. Prisma is fine
    // here since this file is only ever imported from Node route handlers
    // and server components, never from edge middleware.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "USER";
        session.user.termsAcceptedAt = null;
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, termsAcceptedAt: true },
        });
        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.termsAcceptedAt = dbUser.termsAcceptedAt;
        }
      }
      return session;
    },
  },
});
