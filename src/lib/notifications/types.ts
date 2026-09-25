import "server-only";

/** A message that has already been rendered and is ready for a provider. */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /**
   * Plain-text alternative. Not optional: a multipart message is treated as
   * markedly less spammy than an HTML-only one, and some clients show nothing
   * else.
   */
  text: string;
};

/**
 * The seam between this codebase and whoever is actually sending.
 *
 * Deliberately the narrowest thing that works, because it is the whole cost of
 * changing providers later: Resend today, Brevo or SES if the free tier runs
 * out, a console logger in development. Nothing above this interface knows
 * which one it is talking to.
 *
 * `send` throws on failure. The caller (dispatch.ts) is the only place that
 * decides what a failure means — retry, give up, or skip.
 */
export interface EmailTransport {
  /** For logs, so it is obvious which transport ran in which environment. */
  readonly name: string;
  send(message: EmailMessage, opts: { idempotencyKey: string }): Promise<void>;
}
