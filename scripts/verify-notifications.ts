/**
 * Behavioural check for the notification outbox, run against a disposable
 * database.
 *
 * There is no test runner in this repo, and the scheduling rules here are the
 * kind that look obviously right and are quietly off by a week or five and a
 * half hours. So: real Postgres, real Prisma, real dispatch, console transport.
 *
 *   createdb examprep_check
 *   DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
 *   DATABASE_URL=... DIRECT_URL=... npx tsx --conditions=react-server scripts/verify-notifications.ts
 *
 * The `--conditions=react-server` is not optional: the modules under test are
 * marked "server-only", and that package resolves to a module which throws
 * unless the importer is resolving server conditions the way Next.js does.
 *
 * It TRUNCATES every table it touches, so it refuses to run anywhere that does
 * not look local. Do not point it at a database you care about.
 */

import { PrismaClient } from "@prisma/client";
import { planBookingNotifications, planMissingNotifications } from "@/lib/notifications/enqueue";
import { drainNotifications } from "@/lib/notifications/dispatch";
import { meetingWindow, type MeetingRole } from "@/lib/bookings/meeting";
import { buildJoinUrl, isJaasConfigured, isModeratorRole, meetingRoomName } from "@/lib/bookings/jitsi";
import { recordJoin, summarizeAttendance } from "@/lib/bookings/attendance";

const db = new PrismaClient();

/**
 * This script deletes users, bookings and notifications. A typo in an
 * environment variable should not be able to empty production, so require the
 * connection to be visibly local.
 */
const url = process.env.DATABASE_URL ?? "";
const isLocal =
  url.includes("localhost") || url.includes("127.0.0.1") || url.includes("host=/");
if (!isLocal) {
  console.error(
    "Refusing to run: DATABASE_URL does not look local. This script deletes data."
  );
  process.exit(1);
}

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function reset() {
  await db.notification.deleteMany();
  await db.booking.deleteMany();
  await db.availability.deleteMany();
  await db.mentorProfile.deleteMany();
  await db.user.deleteMany();

  await db.user.create({ data: { id: "mentee1", name: "Anita Rao", email: "anita@example.com" } });
  await db.user.create({ data: { id: "mentoru", name: "Dr Verma", email: "verma@example.com" } });
  await db.mentorProfile.create({
    data: { id: "mp1", userId: "mentoru", institute: "IITD", rate: 500, upiId: "a@b", proofUrl: "http://x", verified: true },
  });
  await db.availability.create({
    data: { id: "slot1", mentorId: "mp1", dayOfWeek: 4, startTime: "18:00", duration: 60, isBooked: true },
  });
}

async function makeBooking(startsInMs: number, id = "bk1") {
  return db.booking.create({
    data: {
      id, menteeId: "mentee1", mentorId: "mp1", slotId: "slot1", amount: 500,
      status: "CONFIRMED", meetLink: "https://meet.jit.si/room-" + id,
      scheduledStartAt: new Date(Date.now() + startsInMs), durationMinutes: 60,
    },
  });
}

async function main() {
  console.log("\n=== 1. Planning a session three days out ===");
  await reset();
  const b = await makeBooking(3 * 86_400_000);
  const created = await planBookingNotifications(b.id);
  check("queues 7 rows", created === 7, `got ${created}`);

  const rows = await db.notification.findMany({ orderBy: [{ event: "asc" }, { userId: "asc" }] });
  const byEvent = (e: string) => rows.filter((r) => r.event === e);
  check("2 confirmations (mentee + mentor)", byEvent("BOOKING_CONFIRMED").length === 2);
  check("2 x T-24h", byEvent("SESSION_REMINDER_24H").length === 2);
  check("2 x T-30m", byEvent("SESSION_REMINDER_30M").length === 2);
  check("1 feedback, mentee only", byEvent("SESSION_FEEDBACK").length === 1
    && byEvent("SESSION_FEEDBACK")[0].userId === "mentee1");

  const start = b.scheduledStartAt!.getTime();
  const lead = (e: string) => start - byEvent(e)[0].sendAfter.getTime();
  check("T-24h scheduled 24h before", lead("SESSION_REMINDER_24H") === 86_400_000, `${lead("SESSION_REMINDER_24H")}ms`);
  check("T-30m scheduled 30m before", lead("SESSION_REMINDER_30M") === 1_800_000, `${lead("SESSION_REMINDER_30M")}ms`);
  check("feedback after session ends", byEvent("SESSION_FEEDBACK")[0].sendAfter.getTime() === start + 60*60_000 + 30*60_000);

  console.log("\n=== 2. Idempotency (a webhook delivered three times) ===");
  const again = (await planBookingNotifications(b.id)) + (await planBookingNotifications(b.id));
  check("no duplicate rows on replay", again === 0, `created ${again}`);

  console.log("\n=== 3. Draining: only what is due goes out ===");
  const d1 = await drainNotifications();
  check("sends the 2 confirmations", d1.sent === 2, JSON.stringify(d1));
  check("leaves future reminders pending",
    (await db.notification.count({ where: { status: "PENDING" } })) === 5);
  const d2 = await drainNotifications();
  check("a second tick sends nothing", d2.due === 0 && d2.sent === 0, JSON.stringify(d2));

  console.log("\n=== 4. Confirming late: no 'tomorrow' reminder for a session in 20 minutes ===");
  await reset();
  const soon = await makeBooking(20 * 60_000, "bk2");
  await planBookingNotifications(soon.id);
  const soonRows = await db.notification.findMany({ where: { bookingId: soon.id } });
  check("no T-24h queued", soonRows.every((r) => r.event !== "SESSION_REMINDER_24H"));
  check("no T-30m queued", soonRows.every((r) => r.event !== "SESSION_REMINDER_30M"));
  check("confirmation + feedback only", soonRows.length === 3, `got ${soonRows.length}`);

  console.log("\n=== 5. A cancelled booking must not be reminded ===");
  await reset();
  const cancelled = await makeBooking(3 * 86_400_000, "bk3");
  await planBookingNotifications(cancelled.id);
  await db.notification.updateMany({
    where: { bookingId: cancelled.id, event: "SESSION_REMINDER_30M" },
    data: { sendAfter: new Date(Date.now() - 1000) },
  });
  await db.booking.update({ where: { id: cancelled.id }, data: { status: "REFUNDED" } });
  const d3 = await drainNotifications();
  check("skips every row on a refunded booking", d3.sent === 0 && d3.skipped === d3.due, JSON.stringify(d3));
  const skipReason = await db.notification.findFirst({ where: { status: "SKIPPED" } });
  check("records why", skipReason?.lastError === "booking is REFUNDED", skipReason?.lastError ?? "none");

  console.log("\n=== 6. A reminder whose session has already started is stale ===");
  await reset();
  const past = await db.booking.create({
    data: { id: "bk4", menteeId: "mentee1", mentorId: "mp1", slotId: "slot1", amount: 500,
      status: "CONFIRMED", scheduledStartAt: new Date(Date.now() - 3 * 3_600_000), durationMinutes: 60 },
  });
  await db.notification.create({
    data: { event: "SESSION_REMINDER_30M", channel: "EMAIL", userId: "mentee1",
      bookingId: past.id, sendAfter: new Date(Date.now() - 4 * 3_600_000) },
  });
  const d4 = await drainNotifications();
  check("skips rather than sending it late", d4.skipped === 1 && d4.sent === 0, JSON.stringify(d4));
  check("records why", (await db.notification.findFirst({ where: { bookingId: past.id } }))?.lastError === "session already started");

  console.log("\n=== 7. A recipient with no email address ===");
  await reset();
  await db.user.update({ where: { id: "mentoru" }, data: { email: null } });
  const noAddr = await makeBooking(3 * 86_400_000, "bk5");
  await planBookingNotifications(noAddr.id);
  const d5 = await drainNotifications();
  check("mentee sent, mentor skipped", d5.sent === 1 && d5.skipped === 1, JSON.stringify(d5));

  console.log("\n=== 8. The self-healing sweep ===");
  await reset();
  await makeBooking(3 * 86_400_000, "bk6");           // confirmed, never queued
  await db.booking.create({                            // past session: must be left alone
    data: { id: "bk7", menteeId: "mentee1", mentorId: "mp1", slotId: "slot1", amount: 500,
      status: "CONFIRMED", scheduledStartAt: new Date(Date.now() - 30 * 86_400_000), durationMinutes: 60 },
  });
  const healed = await planMissingNotifications();
  check("queues the stranded upcoming booking", healed === 7, `got ${healed}`);
  check("ignores the month-old session",
    (await db.notification.count({ where: { bookingId: "bk7" } })) === 0);
  check("second sweep is a no-op", (await planMissingNotifications()) === 0);

  console.log("\n=== 9. The meeting-link window ===");
  const now = new Date("2026-10-01T12:30:00Z");
  // `offsetMs` is how far ahead the session starts, so 30 * 60_000 reads as
  // "half an hour before it begins".
  const w = (offsetMs: number, role: MeetingRole = "MENTEE") => meetingWindow({
    scheduledStartAt: new Date(now.getTime() + offsetMs), durationMinutes: 60, role, now,
  }).state;
  check("mentee: shut 30 min before (when the reminder goes out)", w(30 * 60_000) === "TOO_EARLY");
  check("mentee: shut 6 min before", w(6 * 60_000) === "TOO_EARLY");
  check("mentee: open 5 min before", w(5 * 60_000 - 1) === "OPEN");
  check("mentor: still shut 11 min before", w(11 * 60_000, "MENTOR") === "TOO_EARLY");
  check("mentor: open 10 min before, ahead of the mentee",
    w(10 * 60_000 - 1, "MENTOR") === "OPEN" && w(10 * 60_000 - 1, "MENTEE") === "TOO_EARLY");
  check("admin shares the mentor's door", w(10 * 60_000 - 1, "ADMIN") === "OPEN");
  check("open mid-session", w(-30 * 60_000) === "OPEN");
  check("open 59 min after it ends", w(-(60 + 59) * 60_000) === "OPEN");
  check("closed 61 min after it ends", w(-(60 + 61) * 60_000) === "CLOSED");
  check("legacy booking stays joinable",
    meetingWindow({ scheduledStartAt: null, durationMinutes: null, role: "MENTEE", now }).state === "UNSCHEDULED");
  check("only the mentor moderates",
    isModeratorRole("MENTOR") && !isModeratorRole("MENTEE") && !isModeratorRole("ADMIN"));
  check("the room is the one already baked into old meetLinks",
    meetingRoomName({ id: "bk1", mentorId: "mp1abcdefgh" }) === "mp1abcde-bk1");

  console.log("\n=== 10. Attendance ===");
  await reset();
  const attended = await makeBooking(20 * 60_000, "bk8");
  await recordJoin({ bookingId: attended.id, userId: "mentoru", role: "MENTOR", moderator: true,
    scheduledStartAt: attended.scheduledStartAt, now: new Date(attended.scheduledStartAt!.getTime() - 8 * 60_000) });
  await recordJoin({ bookingId: attended.id, userId: "mentoru", role: "MENTOR", moderator: true,
    scheduledStartAt: attended.scheduledStartAt, now: new Date(attended.scheduledStartAt!.getTime() + 60_000) });
  const mentorRow = await db.meetingAttendance.findFirst({ where: { bookingId: attended.id } });
  check("a rejoin is one attendee, not two", mentorRow?.joins === 2, `joins=${mentorRow?.joins}`);
  check("keeps the first arrival, 8 min early",
    mentorRow?.joinedOffsetSeconds === -480, `offset=${mentorRow?.joinedOffsetSeconds}`);
  check("one side joined is not both",
    !summarizeAttendance(await db.meetingAttendance.findMany({ where: { bookingId: attended.id } })).bothSidesJoined);
  await recordJoin({ bookingId: attended.id, userId: "mentee1", role: "MENTEE", moderator: false,
    scheduledStartAt: attended.scheduledStartAt });
  const both = summarizeAttendance(await db.meetingAttendance.findMany({ where: { bookingId: attended.id } }));
  check("both sides joined", both.bothSidesJoined && both.mentor?.moderator === true && both.mentee?.moderator === false);

  console.log("\n=== 11. JaaS moderator tokens ===");
  // The one piece of this that is security-critical and has no visible failure
  // mode: a token that does not verify still looks like a URL. So: a throwaway
  // key pair, mint both sides' tokens through the real code path, and check the
  // signature and the claims that decide who runs the call.
  const { generateKeyPairSync, createVerify } = await import("node:crypto");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.JITSI_APP_ID = "vpaas-magic-cookie-test";
  process.env.JITSI_API_KEY_ID = "key-1";
  process.env.JITSI_PRIVATE_KEY = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString()
    // Written back the way a hosting dashboard stores a PEM, to prove the
    // literal-backslash-n unescaping in jitsi.ts is doing its job.
    .replace(/\n/g, "\\n");

  const jaasBooking = {
    id: "bk9",
    mentorId: "mp1abcdefgh",
    scheduledStartAt: new Date(Date.now() + 5 * 60_000),
    durationMinutes: 60,
  };
  const url = (role: MeetingRole) =>
    buildJoinUrl({ booking: jaasBooking, role, displayName: "Dr Verma", email: "v@x.com", userId: "u1" });

  check("configured JaaS is detected", isJaasConfigured());
  const mentorUrl = url("MENTOR");
  check("points at the JaaS app, not public Jitsi",
    mentorUrl.startsWith("https://8x8.vc/vpaas-magic-cookie-test/mp1abcde-bk9?jwt="), mentorUrl.slice(0, 80));

  const jwt = new URL(mentorUrl).searchParams.get("jwt")!;
  const [h, pl, sig] = jwt.split(".");
  const verified = createVerify("RSA-SHA256").update(`${h}.${pl}`).verify(publicKey, Buffer.from(sig, "base64url"));
  check("signature verifies against the public key", verified);

  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const claims = JSON.parse(Buffer.from(pl, "base64url").toString());
  check("kid is app id + key id", header.kid === "vpaas-magic-cookie-test/key-1", header.kid);
  check("scoped to this one room", claims.room === "mp1abcde-bk9" && claims.aud === "jitsi" && claims.sub === "vpaas-magic-cookie-test");
  check("the mentor is the moderator", claims.context.user.moderator === "true");
  check("expires after the window closes, not in a week",
    claims.exp > Date.now() / 1000 && claims.exp < Date.now() / 1000 + 3 * 60 * 60);
  check("recording and streaming are off",
    claims.context.features.recording === "false" && claims.context.features.livestreaming === "false");

  const claimsFor = (role: MeetingRole) =>
    JSON.parse(
      Buffer.from(new URL(url(role)).searchParams.get("jwt")!.split(".")[1], "base64url").toString()
    );
  check("the mentee is not", claimsFor("MENTEE").context.user.moderator === "false");
  check("nor is an admin looking in", claimsFor("ADMIN").context.user.moderator === "false");

  delete process.env.JITSI_APP_ID;
  check("without credentials it falls back to public Jitsi",
    !isJaasConfigured() && url("MENTOR").startsWith("https://meet.jit.si/mp1abcde-bk9#"));

  console.log(failures === 0 ? "\nALL PASSED\n" : `\n${failures} FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => db.$disconnect());
