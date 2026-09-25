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
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/verify-notifications.ts
 *
 * It TRUNCATES every table it touches, so it refuses to run anywhere that does
 * not look local. Do not point it at a database you care about.
 */

import { PrismaClient } from "@prisma/client";
import { planBookingNotifications, planBookingEmails, planMissingNotifications } from "@/lib/notifications/enqueue";
import { drainNotifications } from "@/lib/notifications/dispatch";
import { meetingWindow } from "@/lib/bookings/meeting";

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
  const w = (offsetMs: number) => meetingWindow({
    scheduledStartAt: new Date(now.getTime() + offsetMs), durationMinutes: 60, now,
  }).state;
  check("closed 35 min before", w(35 * 60_000) === "TOO_EARLY");
  check("open 30 min before (when the reminder goes out)", w(30 * 60_000 - 1) === "OPEN");
  check("open mid-session", w(-30 * 60_000) === "OPEN");
  check("open 59 min after it ends", w(-(60 + 59) * 60_000) === "OPEN");
  check("closed 61 min after it ends", w(-(60 + 61) * 60_000) === "CLOSED");
  check("legacy booking stays joinable",
    meetingWindow({ scheduledStartAt: null, durationMinutes: null, now }).state === "UNSCHEDULED");

  console.log(failures === 0 ? "\nALL PASSED\n" : `\n${failures} FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().finally(() => db.$disconnect());
