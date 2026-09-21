import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";
import { averageRating, formatRating } from "@/lib/reviews";
import { formatAir } from "@/lib/mentors/rank";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Mentor profile";

/**
 * The preview card a shared profile unfurls into.
 *
 * This is the whole point of the share button: a bare link in a WhatsApp group
 * is ignored, a card carrying a rank and a rating is opened. Rendered from the
 * same three facts the profile leads with — credential, current role, rating —
 * so the preview never promises something the page doesn't show.
 *
 * Deliberately no avatar: the image is fetched over the network at render
 * time, and a Google profile photo that 404s takes the whole card down with
 * it. Initials on brand colour never fail.
 *
 * Satori supports flexbox only — no grid, every element needs an explicit
 * `display`, `gap` is unreliable across axes (hence the explicit margins), and
 * the fallback font has no glyph for ★, so the star is drawn as a path.
 */
export default async function MentorOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const mentor = await prisma.mentorProfile.findUnique({
    where: { id },
    select: {
      verified: true,
      rank: true,
      examCleared: true,
      examYear: true,
      currentRole: true,
      institute: true,
      story: true,
      reviewCount: true,
      ratingSum: true,
      user: { select: { name: true } },
    },
  });

  const name = mentor?.user.name ?? siteConfig.name;
  const credential = mentor
    ? [formatAir(mentor.rank), mentor.examCleared, mentor.examYear || null].filter(Boolean).join("  ·  ")
    : siteConfig.tagline;
  const average = mentor && mentor.verified ? averageRating(mentor) : null;

  // Enough of the mentor's own line to be worth reading, cut on a word.
  const story = (mentor?.story ?? "").trim();
  const quote = story.length > 150 ? `${story.slice(0, 150).replace(/\s+\S*$/, "")}…` : story;

  const ink = "#302a24";
  const indigo = "#4c3fc7";
  const marigold = "#e2a33f";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 72px",
          background: "#fbf9f4",
          color: ink,
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand rule at the top edge — the one piece of chrome. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 12,
            display: "flex",
            background: indigo,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 104,
                height: 104,
                borderRadius: 52,
                marginRight: 24,
                background: indigo,
                color: "#fbf9f4",
                fontSize: 46,
                fontWeight: 700,
              }}
            >
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", fontSize: 58, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {name}
              </div>
              <div style={{ display: "flex", fontSize: 28, color: "#6b6258" }}>
                {mentor?.currentRole || mentor?.institute || siteConfig.tagline}
              </div>
            </div>
          </div>

          {credential && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "14px 24px",
                borderRadius: 14,
                background: "#e8e6fa",
                color: indigo,
                fontSize: 30,
                fontWeight: 600,
              }}
            >
              {credential}
            </div>
          )}

          {quote && (
            <div
              style={{
                display: "flex",
                borderLeft: `6px solid ${indigo}`,
                paddingLeft: 26,
                fontSize: 30,
                lineHeight: 1.45,
                color: "#463f38",
                fontStyle: "italic",
              }}
            >
              “{quote}”
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {average !== null ? (
              <>
                <svg width="38" height="38" viewBox="0 0 24 24" style={{ marginRight: 12 }}>
                  <path
                    fill={marigold}
                    d="M12 2.3l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.37l-5.9 3.1 1.13-6.57L2.45 9.24l6.6-.96L12 2.3z"
                  />
                </svg>
                <div style={{ display: "flex", fontSize: 38, fontWeight: 700, marginRight: 12 }}>
                  {formatRating(average)}
                </div>
                <div style={{ display: "flex", fontSize: 28, color: "#6b6258" }}>
                  from {mentor?.reviewCount} rated {mentor?.reviewCount === 1 ? "session" : "sessions"}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", fontSize: 28, color: "#6b6258" }}>
                1:1 video sessions · book a slot
              </div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: indigo }}>
            {siteConfig.name}
          </div>
        </div>
      </div>
    ),
    size
  );
}
