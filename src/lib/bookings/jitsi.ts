import "server-only";

import { createSign } from "node:crypto";

import { jitsiRoomUrl } from "@/config/site";
import { JOIN_CLOSES_AFTER_MS, type MeetingRole } from "@/lib/bookings/meeting";

/**
 * Who runs the call.
 *
 * Public Jitsi (meet.jit.si) has no concept of "this person is the host". The
 * first participant into an empty room is made its moderator and everyone after
 * them is a guest, which is why a mentee who clicks early ends up holding the
 * mute and kick controls for their own mentor's session. There is no URL
 * parameter, no config flag and no API on the public instance that changes
 * that — moderation there is a race, and the only lever we have over a race is
 * who gets to start running (see the staggered doors in meeting.ts).
 *
 * The fix is a signed token, which means JaaS: 8x8's hosted Jitsi, where every
 * participant arrives with a JWT and the `context.user.moderator` claim inside
 * it decides who is in charge. Set the three JITSI_* variables in .env.example
 * and this module mints one token per person per session — moderator for the
 * mentor, guest for the mentee, guest for an admin looking in. Leave them unset
 * and it falls back to meet.jit.si exactly as before, with the mentor's earlier
 * door as the (best-effort) moderator rule.
 *
 * Nothing else in the app needs to know which of the two is in play.
 */

/** 8x8's hosted Jitsi. Only ever a different host, never a different room. */
const JAAS_DOMAIN = process.env.JITSI_DOMAIN ?? "8x8.vc";

/**
 * How long a minted token stays valid past the end of the call window.
 *
 * Short on purpose: a JaaS token is a bearer credential for that room, so it
 * should expire not long after the session it was minted for. The window rule
 * in meeting.ts already refuses to mint one outside the session; this is the
 * backstop for a token that leaks out of a browser afterwards.
 */
const TOKEN_GRACE_MS = 10 * 60 * 1000;

type JaasConfig = { appId: string; keyId: string; privateKey: string };

/**
 * JaaS credentials, or null when they aren't configured.
 *
 * Read per call rather than at module load: this file is imported on the
 * booking page's render path, and a missing variable must degrade to public
 * Jitsi rather than crash a page somebody has paid for.
 */
function jaasConfig(): JaasConfig | null {
  const appId = process.env.JITSI_APP_ID?.trim();
  const keyId = process.env.JITSI_API_KEY_ID?.trim();
  // Same convention as FIREBASE_PRIVATE_KEY: hosting dashboards store a PEM as
  // one line with literal backslash-n, which crypto will not parse.
  const privateKey = process.env.JITSI_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!appId || !keyId || !privateKey) return null;
  return { appId, keyId, privateKey };
}

/** Whether calls are running on JaaS (and so whether moderation is guaranteed). */
export function isJaasConfigured(): boolean {
  return jaasConfig() !== null;
}

/**
 * The room name for a booking.
 *
 * Derived, not stored, and deliberately identical to the string baked into
 * `Booking.meetLink` at confirmation time (see src/lib/payments/sync.ts): a
 * session confirmed before this code existed has to resolve to the same room,
 * or the mentor and the mentee end up in two different empty ones.
 *
 * Lowercased because JaaS matches the `room` claim against the room in the URL
 * case-insensitively, and a mismatch there reads as "token is not for this
 * room". Both ids are cuids, so this is a no-op today; it is here so a future
 * id scheme cannot break tokens silently.
 */
export function meetingRoomName(booking: { id: string; mentorId: string }): string {
  return `${booking.mentorId.slice(0, 8)}-${booking.id}`.toLowerCase();
}

/** Only the mentor gets the mute/kick/lobby controls for their own session. */
export function isModeratorRole(role: MeetingRole): boolean {
  return role === "MENTOR";
}

/**
 * The URL this person should be sent to, for this session, right now.
 *
 * Call it only after the window rule in meeting.ts has said yes — it does not
 * re-check, and on JaaS it returns a token that is enough on its own to get
 * into the room.
 */
export function buildJoinUrl(params: {
  booking: { id: string; mentorId: string; scheduledStartAt: Date | null; durationMinutes: number | null };
  role: MeetingRole;
  displayName: string | null;
  email?: string | null;
  userId: string;
}): string {
  const { booking, role, displayName, email, userId } = params;
  const room = meetingRoomName(booking);
  const config = jaasConfig();

  // Carried in the fragment, which never leaves the browser: Jitsi reads
  // `#userInfo.displayName` and the `config.*` overrides client-side, so
  // nobody has to type their own name into a room we already know them in.
  const fragment = new URLSearchParams();
  if (displayName) fragment.set("userInfo.displayName", `"${displayName}"`);
  // Straight in. The prejoin screen is a second "are you sure" in front of a
  // call that is already gated, timed and one click deep.
  fragment.set("config.prejoinPageEnabled", "false");
  const hash = `#${fragment.toString()}`;

  if (!config) {
    // Public Jitsi. Whoever arrives first moderates, which is what the mentor's
    // earlier door is for.
    return `${jitsiRoomUrl(booking.mentorId.slice(0, 8), booking.id)}${hash}`;
  }

  const token = mintJaasToken({
    config,
    room,
    userId,
    name: displayName,
    email,
    moderator: isModeratorRole(role),
    expiresAt: tokenExpiry(booking),
  });

  return `https://${JAAS_DOMAIN}/${config.appId}/${room}?jwt=${token}${hash}`;
}

/** Valid until a little past the point the session page stops letting anyone in. */
function tokenExpiry(booking: { scheduledStartAt: Date | null; durationMinutes: number | null }): Date {
  const now = Date.now();
  if (!booking.scheduledStartAt) return new Date(now + 2 * 60 * 60 * 1000);

  const endsAt =
    booking.scheduledStartAt.getTime() + (booking.durationMinutes ?? 30) * 60_000;
  // Never shorter than a few minutes, or joining right at the close of the
  // window would hand out a token that has already expired.
  return new Date(Math.max(endsAt + JOIN_CLOSES_AFTER_MS + TOKEN_GRACE_MS, now + 15 * 60 * 1000));
}

/**
 * A JaaS JWT, signed RS256 with the API key from the JaaS console.
 *
 * Hand-rolled rather than pulled from a JWT library: this is one header, one
 * payload and one `crypto.createSign` call, and the alternative is a dependency
 * on the security-critical path that we would then have to keep patched.
 *
 * The claim shape is JaaS's, not ours — `aud: "jitsi"`, `iss: "chat"`, the app
 * id as `sub`, and the room this token is good for as `room`. Scoping `room` to
 * the one booking (rather than the `"*"` the console examples use) is what stops
 * a token minted for one session from opening any other room in the account.
 */
function mintJaasToken(params: {
  config: JaasConfig;
  room: string;
  userId: string;
  name: string | null;
  email?: string | null;
  moderator: boolean;
  expiresAt: Date;
}): string {
  const { config, room, userId, name, email, moderator, expiresAt } = params;
  const nowSeconds = Math.floor(Date.now() / 1000);

  // The console gives the key id on its own; the `kid` JaaS expects is the app
  // id and the key id joined. Accept either form so a value pasted from either
  // screen works.
  const kid = config.keyId.includes("/") ? config.keyId : `${config.appId}/${config.keyId}`;

  const header = { alg: "RS256", kid, typ: "JWT" };
  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: config.appId,
    room,
    iat: nowSeconds,
    // A minute of slack for a server clock that runs slightly ahead of 8x8's.
    nbf: nowSeconds - 60,
    exp: Math.floor(expiresAt.getTime() / 1000),
    context: {
      user: {
        id: userId,
        name: name ?? "Guest",
        // Only sent when we have one: an empty string here shows up as a blank
        // avatar tooltip rather than as nothing.
        ...(email ? { email } : {}),
        moderator: moderator ? "true" : "false",
      },
      // Everything off unless a call actually needs it. Recording a mentoring
      // session is a consent question, not a default, and live streaming and
      // outbound dial-out are simply not features of this product.
      features: {
        livestreaming: "false",
        recording: "false",
        transcription: "false",
        "outbound-call": "false",
      },
    },
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(config.privateKey)
    .toString("base64url");

  return `${signingInput}.${signature}`;
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}
