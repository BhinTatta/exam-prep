# Video calls

Every confirmed booking gets a Jitsi room. Three things decide how somebody
reaches it: **when** the door opens, **who** runs the call, and **what we learn**
about who turned up.

## When the door opens

| Who | Can join from | Until |
| --- | --- | --- |
| Mentor | 10 minutes before the start | 1 hour after the session ends |
| Mentee | 5 minutes before the start | 1 hour after the session ends |
| Admin (support) | 10 minutes before the start | 1 hour after the session ends |

One rule, in `src/lib/bookings/meeting.ts`, consulted in two places:

- `src/components/bookings/join-call-button.tsx` decides what the session page
  shows. Before the door opens there is **no button** — just a line saying when
  it appears, counting down in the last hour. A disabled button an hour ahead of
  time reads as something being broken.
- `src/app/bookings/[id]/join/route.ts` decides whether a room URL exists. This
  is the gate. The button is a courtesy.

That split matters, because the old version only had the button. The room URL
was written into the page's HTML as an `href` at render time and mailed out in
every T-30m reminder, so "the link appears 30 minutes before" was true of the
button and false of the link: view-source, or scroll back through your inbox, and
the room was yours whenever you liked — forever, since the URL is derived from
the booking id and never changes. Now nothing renders it and no email carries it.
The only way to get a room URL is to ask `/bookings/[id]/join`, which checks who
you are, whether the session is yours, and what time it is, on every request.

Bookings that predate `scheduledStartAt` resolve to `UNSCHEDULED` and stay
joinable at any time. Tightening a rule should not strand a session somebody
already paid for.

## Who runs the call

On public `meet.jit.si` the first participant into an empty room is made its
moderator and everyone after them is a guest. There is no URL parameter, no
config flag and no API that changes this. So on the free instance, moderation is
a race, and the mentor's five-minute head start is our only lever on it: the
mentor's door opens first, so the mentor normally opens the room, so the mentor
normally moderates. A mentor who turns up late does not.

To make it a guarantee, point the app at **8x8 JaaS** (hosted Jitsi, free tier
covers 25,000 monthly active users) by setting `JITSI_APP_ID`,
`JITSI_API_KEY_ID` and `JITSI_PRIVATE_KEY` — see `.env.example`. Then
`src/lib/bookings/jitsi.ts` signs a JWT per person per request:

- `context.user.moderator: "true"` for the mentor, `"false"` for the mentee and
  for an admin looking in. Arrival order stops mattering.
- `room` is scoped to that one booking's room, so a token for one session cannot
  open another.
- `exp` lands shortly after the join window closes, so a token that leaks out of
  a browser afterwards is already dead.
- Recording, live streaming, transcription and dial-out are all off. Recording a
  mentoring session is a consent question, not a default.

Nothing else in the app knows which mode is active. Unset the variables and it
falls back to `meet.jit.si` with the staggered doors.

The JWT is signed with `node:crypto` rather than a JWT library — one header, one
payload, one `createSign` call, against a dependency on the security-critical
path that would then need keeping patched. Section 11 of
`scripts/verify-notifications.ts` mints real tokens against a throwaway key pair
and verifies the signature and every claim above.

## Who turned up

`MeetingAttendance` (one row per person per booking) is written by the join route
when it hands out a room URL. It answers the question that decides whether the
product works: of the sessions people paid for, how many did both sides actually
turn up to? Reviews only ever come from the calls that went well, and the
post-session "did this happen?" prompt is a self-report; this is the one signal
nobody has to volunteer.

It records `firstJoinedAt`, `lastJoinedAt`, a `joins` counter (a rejoin after a
dropped connection is one attendee, not two), whether we granted them moderator,
and `joinedOffsetSeconds` — how early or late they were, relative to the start.
The admin sessions page shows it per session ("both joined, mentor first") and as
a strip across the top: how many started sessions had both sides, one side, or
nobody.

What it cannot tell you: whether their camera worked, how long they stayed, or
whether they sat in the room alone. A join is a click on the join button. Real
presence means reporting back from inside the call — the Jitsi iframe API
(`videoConferenceJoined` / `participantJoined` / `videoConferenceLeft`), which
needs the call embedded in a page of ours rather than opened in a new tab. That
would sit alongside these columns rather than replace them, since intent to join
and time in the room are different facts.

## Running the checks

```
createdb examprep_check
DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
DATABASE_URL=... DIRECT_URL=... npx tsx --conditions=react-server scripts/verify-notifications.ts
```

Sections 9-11 cover the join window, attendance and the JaaS tokens.
