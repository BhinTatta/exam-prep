"use client";

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export function TelegramLoginButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    window.onTelegramAuth = (user: TelegramUser) => {
      signIn("telegram", {
        payload: JSON.stringify({ ...user, id: String(user.id), auth_date: String(user.auth_date) }),
        callbackUrl,
      });
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);

    return () => {
      window.onTelegramAuth = undefined;
    };
  }, [botUsername, callbackUrl]);

  if (!botUsername) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
