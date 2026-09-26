import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/auth-helpers";
import { recordJoin } from "@/lib/bookings/attendance";
import { buildJoinUrl, isModeratorRole } from "@/lib/bookings/jitsi";
import { canJoinNow, meetingWindow, type MeetingRole } from "@/lib/bookings/meeting";

/**
 * The only door into a booking's video call.
 *
 * Everything about joining a call is decided here, on the server, at the moment
 * somebody asks: who they are, whether this session is theirs, whether it is
 * time yet, whether they moderate it, and only then what the room URL is. The
 * button on the session page is a convenience in front of this; hiding it is
 * not a gate, because a URL anybody can type is not protected by a button
 * nobody rendered.
 *
 * Which is also why the room URL is no longer in the page's HTML. It used to be
 * an `href` written at render time, so "the link appears 30 minutes before" was
 * only ever true of the button — the address it pointed at was sitting in the
 * markup, and the same permanent room URL was in every reminder email. Minting
 * it per request is what makes the window real, and it is what lets a JaaS
 * token be scoped to one person, one room and one hour.
 */

// A join is a decision about this second, for this person. Never cached.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) {
    // Straight back here once they are in, so a reminder email opened on a
    // signed-out phone still lands them in the call.
    return bounce(`/sign-in?callbackUrl=${encodeURIComponent(`/bookings/${id}/join`)}`);
  }
  const user = session.user;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      menteeId: true,
      mentorId: true,
      scheduledStartAt: true,
      durationMinutes: true,
      slot: { select: { duration: true } },
      mentor: { select: { userId: true } },
    },
  });
  if (!booking) return new Response("Not found", { status: 404 });

  const role = resolveRole(booking, user.id, user.role);
  // 404 rather than 403, matching the session page: somebody poking at booking
  // ids should not learn which ones exist.
  if (!role) return new Response("Not found", { status: 404 });

  // A room only exists for a session that is actually happening. Cancelled,
  // refunded and unpaid bookings go back to the page that explains why.
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
    return bounce(`/bookings/${booking.id}`);
  }

  const durationMinutes = booking.durationMinutes ?? booking.slot.duration;
  const window = meetingWindow({
    scheduledStartAt: booking.scheduledStartAt,
    durationMinutes,
    role,
  });
  if (!canJoinNow(window)) {
    // The page they came from renders the reason — a countdown before the
    // session, or "this has ended" after it.
    return bounce(`/bookings/${booking.id}`);
  }

  const moderator = isModeratorRole(role);

  // Before the redirect, so a join is recorded even if the browser never comes
  // back to tell us anything. recordJoin never throws.
  await recordJoin({
    bookingId: booking.id,
    userId: user.id,
    role,
    moderator,
    scheduledStartAt: booking.scheduledStartAt,
  });

  const url = buildJoinUrl({
    booking: {
      id: booking.id,
      mentorId: booking.mentorId,
      scheduledStartAt: booking.scheduledStartAt,
      durationMinutes,
    },
    role,
    displayName: user.name ?? null,
    email: user.email ?? null,
    userId: user.id,
  });

  // 302 and no-store: on JaaS this URL carries a signed token for one person,
  // so nothing between here and the browser may keep a copy.
  return new Response(null, {
    status: 302,
    headers: { location: url, "cache-control": "no-store, max-age=0" },
  });
}

/**
 * Which side of the session this viewer is on, or null if it is not theirs.
 *
 * Admins are let in for support, and are deliberately last: a mentor who also
 * has the admin role is still the mentor of their own session, and so still its
 * moderator.
 */
function resolveRole(
  booking: { menteeId: string; mentor: { userId: string } },
  userId: string,
  userRole: string | undefined
): MeetingRole | null {
  if (booking.menteeId === userId) return "MENTEE";
  if (booking.mentor.userId === userId) return "MENTOR";
  if (hasRole(userRole, "ADMIN")) return "ADMIN";
  return null;
}

function bounce(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: path, "cache-control": "no-store, max-age=0" },
  });
}
