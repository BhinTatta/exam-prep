import "server-only";

import { Resend } from "resend";
import type { EmailMessage, EmailTransport } from "../types";

/**
 * Sending identity. `EMAIL_FROM` should be an address on the verified sending
 * subdomain (noreply@mail.iitjambuddy.com), not on the root domain — sender
 * reputation is tracked per-domain, so keeping transactional mail on its own
 * subdomain means a spam problem here cannot damage human mail at
 * iitjambuddy.com.
 *
 * `EMAIL_REPLY_TO` is a real inbox (Cloudflare Email Routing forwards it), so
 * somebody who hits reply reaches a person instead of a black hole.
 */
const FROM = process.env.EMAIL_FROM ?? "IITJAM Buddy <noreply@mail.iitjambuddy.com>";
const REPLY_TO = process.env.EMAIL_REPLY_TO;

class ResendTransport implements EmailTransport {
  readonly name = "resend";
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage, opts: { idempotencyKey: string }): Promise<void> {
    // Resend reports API errors in the payload rather than throwing, so an
    // unchecked call looks like a success and silently drops mail.
    const { data, error } = await this.client.emails.send(
      {
        from: FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
      },
      // Delivery here is at-least-once: a crash between "Resend accepted" and
      // "row marked SENT" replays the send. Keying on the notification row id
      // is what keeps that from becoming a second copy in somebody's inbox.
      { idempotencyKey: opts.idempotencyKey }
    );

    if (error) {
      throw new Error(`resend: ${error.name ?? "error"}: ${error.message ?? "unknown"}`);
    }
    if (!data?.id) {
      throw new Error("resend: accepted the request but returned no message id");
    }
  }
}

/**
 * Development transport. Every provider refuses to mail arbitrary addresses
 * until the sending domain is verified, so this is how the flow is exercised
 * before DNS propagates — and it means a local run never mails a real student.
 */
class ConsoleTransport implements EmailTransport {
  readonly name = "console";

  async send(message: EmailMessage): Promise<void> {
    console.info(
      [
        "",
        "──── email (not sent — console transport) ────",
        `to:      ${message.to}`,
        `subject: ${message.subject}`,
        "",
        message.text,
        "─────────────────────────────────────────────",
        "",
      ].join("\n")
    );
  }
}

/**
 * A transport that refuses to pretend. Standing in for a missing API key in
 * production, so the rows retry and then fail loudly with a `lastError` that
 * names the actual problem, rather than being marked SENT having gone nowhere.
 */
class MisconfiguredTransport implements EmailTransport {
  readonly name = "misconfigured";

  async send(): Promise<void> {
    throw new Error(
      "RESEND_API_KEY is not set, so no email can be sent. Set it in the Vercel project's environment variables."
    );
  }
}

let cached: EmailTransport | undefined;

export function emailTransport(): EmailTransport {
  if (cached) return cached;

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    cached = new ResendTransport(apiKey);
  } else if (process.env.NODE_ENV === "production") {
    cached = new MisconfiguredTransport();
  } else {
    cached = new ConsoleTransport();
  }
  return cached;
}
