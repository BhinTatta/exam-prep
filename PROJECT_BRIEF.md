# Exam Prep Platform — v1 Project Brief

> Working name: "JAM Physics" (config-driven, will expand beyond Physics later — see `config/site.ts`)

## Goal
A free, no-ads, community-first web platform for physics entrance exam prep (JAM, NET, GATE),
built to scale to other subjects later. v1 ships: resources, community Q&A, a manual-payment
mentor marketplace, and role-based moderation. No native app in v1 — installable PWA + a
sideloaded APK later (not Play Store, due to third-party coaching material).

## Tech stack
- **Framework**: Next.js 14 (App Router) — frontend + backend (Server Actions / API routes) in one codebase
- **UI**: shadcn/ui + Tailwind CSS
- **Database**: Postgres via Neon (portable, not Vercel-proprietary)
- **ORM**: Prisma
- **Auth**: NextAuth.js — Google provider + Telegram Login Widget (custom provider)
- **File storage**: Supabase Storage (S3-compatible, portable) — for mentor proof docs, uploaded notes
- **Video calls**: Jitsi Meet (jitsi.org, free, no API key) — room per booking: `meet.jit.si/{shortName}-{bookingId}`
- **Deploy**: Vercel (frontend/backend) + Neon (DB) + Supabase (storage) — all free tier
- **Domain**: user-owned, pointed at Vercel

**Portability rule**: avoid Vercel-proprietary products (Vercel KV/Postgres/Blob). Everything above
is swappable to another host without a rewrite.

## Config-driven branding
All site identity (name, tagline, subjects, exams) lives in `config/site.ts` — no hardcoded
strings elsewhere. `Resource` and `Question` models already carry a `subject` field so adding
Chemistry/Maths later needs zero schema changes.

## Roles
`user | moderator | mentor | admin`

| Action | user | moderator | mentor | admin |
|---|---|---|---|---|
| Post Q&A / comment | ✅ | ✅ | ✅ | ✅ |
| Add/edit resources | ❌ | ✅ | ❌ | ✅ |
| Delete/pin any post | ❌ | ✅ | ❌ | ✅ |
| Apply to become mentor | ✅ | ✅ | — | — |
| Set own availability/rate | — | — | ✅ | ✅ |
| Verify mentor applications | ❌ | ❌ | ❌ | ✅ |
| Confirm payments / trigger payout | ❌ | ❌ | ❌ | ✅ |
| Promote user → moderator | ❌ | ❌ | ❌ | ✅ |

Moderators: content only. Never money or role management (least-privilege by design).

## v1 Feature list

### 1. Auth
- Google Sign-In (NextAuth)
- Telegram Login Widget
- Single `User` table, `role` enum

### 2. Resources section
- Categorized library: Subject → Institute (Fiziks/CED/etc.) / Books / Test series
- Fields: title, external link, category, subject, tags, `uploaded_by`
- Moderators add/edit; admin can pin/feature

### 3. Community Q&A
- Post question: title, body (KaTeX/LaTeX rendering for equations), optional image
- Comment thread, upvote on comments
- "Ask ChatGPT" button on every question → deep link `https://chat.openai.com/?q=<encoded question>` — zero cost
- Moderator: pin, delete spam, lock threads

### 4. Mentor marketplace (manual payment, v1)
- Mentor signup: institute, rank/AIR proof upload, subjects, rate, availability
- Admin manually verifies mentor before going live
- Mentee books slot → sees UPI ID/QR + amount → submits UTR/screenshot
- Admin manually confirms payment → booking → `confirmed` → Jitsi link generated
- Post-session: mentee prompted "did this happen?"
- Admin dashboard: pending payment verifications, pending mentor approvals, sessions, manual payout checklist
- **Built so `Booking.status` is the single state machine** — swapping in Cashfree/Razorpay Route
  in v2 means wiring a webhook to update this field, not a rearchitecture

### 5. Admin dashboard
- Pending mentor approvals
- Pending payment verifications
- Content moderation queue (if not delegated to mods)
- Session list + manual payout checklist

## Core schema (Prisma-style sketch)

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  role        Role     @default(USER)
  telegramId  String?
  googleId    String?
  createdAt   DateTime @default(now())
}

enum Role {
  USER
  MODERATOR
  MENTOR
  ADMIN
}

model Resource {
  id         String   @id @default(cuid())
  title      String
  url        String
  category   String   // institute / books / test-series
  subject    String   // "Physics" now, extensible
  tags       String[]
  uploadedBy String
  createdAt  DateTime @default(now())
}

model Question {
  id        String   @id @default(cuid())
  userId    String
  title     String
  body      String
  subject   String
  pinned    Boolean  @default(false)
  createdAt DateTime @default(now())
  comments  Comment[]
}

model Comment {
  id         String   @id @default(cuid())
  questionId String
  userId     String
  body       String
  upvotes    Int      @default(0)
  createdAt  DateTime @default(now())
}

model MentorProfile {
  id        String   @id @default(cuid())
  userId    String   @unique
  subjects  String[]
  rate      Int      // in INR
  proofUrl  String
  verified  Boolean  @default(false)
  bio       String?
}

model Availability {
  id        String   @id @default(cuid())
  mentorId  String
  dayOfWeek Int
  startTime String
  isBooked  Boolean  @default(false)
}

model Booking {
  id                 String   @id @default(cuid())
  menteeId           String
  mentorId           String
  slotId             String
  status             BookingStatus @default(PENDING_PAYMENT)
  utrReference       String?
  meetLink           String?
  paymentVerifiedBy  String?
  paymentVerifiedAt  DateTime?
  createdAt          DateTime @default(now())
}

enum BookingStatus {
  PENDING_PAYMENT
  PAYMENT_SUBMITTED
  CONFIRMED
  COMPLETED
  DISPUTED
}

model Payout {
  id          String   @id @default(cuid())
  bookingId   String
  amount      Int
  paidByAdmin String
  paidAt      DateTime?
}
```

## Explicitly out of scope for v1
- Mock test engine (deferred — large scope on its own, add after core platform is live)
- Cashfree/Razorpay Route automated payouts (v2)
- Telegram bot auto-posting (v2)
- Native app / Play Store (later, and only after resources section is legally cleaned up or
  institute permissions obtained — see licensing note below)
- Data-labeling/dataset business (deferred indefinitely, not planned)

## Known risk to keep in view
Coaching material (Fiziks, CED, etc.) linked in Resources is third-party copyrighted content,
not public domain. Plan: reach out to institutes for informal permission/credit arrangement.
This affects future Play Store eligibility — sideloaded APK reduces platform-enforcement risk
but not underlying legal exposure.

## Suggested build order for Claude Code
1. Next.js + Tailwind + shadcn init, `config/site.ts` scaffold
2. Prisma schema + Neon connection, run first migration
3. NextAuth (Google first, Telegram widget second)
4. Resources CRUD (admin/moderator only for writes)
5. Q&A + comments + ChatGPT deep-link button
6. Mentor signup + admin verification flow
7. Booking flow + manual UPI confirmation + Jitsi link generation
8. Admin dashboard tying it all together
