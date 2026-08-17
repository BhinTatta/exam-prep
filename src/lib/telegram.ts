import { createHash, createHmac, timingSafeEqual } from "crypto";

export type TelegramAuthPayload = {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
};

const MAX_AUTH_AGE_SECONDS = 60 * 60 * 24; // 1 day

/**
 * Verifies the Telegram Login Widget payload per Telegram's documented scheme:
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(
  payload: TelegramAuthPayload,
  botToken: string
): boolean {
  const { hash, ...rest } = payload;
  if (!hash) return false;

  const authDate = Number(rest.auth_date);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) {
    return false;
  }

  const dataCheckString = Object.keys(rest)
    .filter((key) => rest[key as keyof typeof rest] !== undefined)
    .sort()
    .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
    .join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
