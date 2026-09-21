// Single source of truth for site identity, subjects, and exams.
// Change this file to rebrand or expand to new subjects — nothing else should
// need to hardcode these strings.

export const siteConfig = {
  name: "IITJAM Buddy",
  shortName: "JAMP",
  tagline: "Free, community-first prep for JAM, NET & GATE Physics",
  description:
    "A free, no-ads, community-first platform for physics entrance exam prep — resources, community Q&A, and a mentor marketplace.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supportEmail: "support@example.com",
  ogImage: "/og.png",
} as const;

// Every logo variant lives in /public/brand. Swap the files there (keeping the
// names) to rebrand the whole site; nothing else references a logo path.
// `width`/`height` are the assets' intrinsic pixel sizes — next/image uses them
// to reserve space, so they have to be updated alongside any new artwork.
// See public/brand/README.md.
export const brandAssets = {
  // Horizontal mark + wordmark. The navbar's default.
  lockup: {
    light: "/brand/logo-light.png",
    dark: "/brand/logo-dark.png",
    width: 652,
    height: 160,
  },
  // Vertical mark + wordmark + tagline, for centred surfaces like sign-in.
  stacked: {
    light: "/brand/logo-stacked-light.png",
    dark: "/brand/logo-stacked-dark.png",
    width: 505,
    height: 381,
  },
  // Mark on its own, for tight spots where the wordmark won't fit.
  mark: {
    light: "/brand/mark-light.png",
    dark: "/brand/mark-dark.png",
    width: 197,
    height: 248,
  },
} as const;

export type BrandVariant = keyof typeof brandAssets;

// Tab, home-screen, and install icons. Wired up in src/app/layout.tsx.
export const brandIcons = {
  favicon: "/brand/favicon.ico",
  apple: "/brand/apple-icon.png",
  png192: "/brand/icon-192.png",
  png512: "/brand/icon-512.png",
} as const;

export type Subject = {
  slug: string;
  label: string;
};

// Physics only in v1. Add entries here (and nowhere else) to expand.
export const subjects: Subject[] = [{ slug: "physics", label: "Physics" }];

export type Exam = {
  slug: string;
  label: string;
  fullName: string;
};

export const exams: Exam[] = [
  { slug: "jam", label: "JAM", fullName: "Joint Admission Test for M.Sc." },
  { slug: "net", label: "NET", fullName: "CSIR/UGC National Eligibility Test" },
  { slug: "gate", label: "GATE", fullName: "Graduate Aptitude Test in Engineering" },
];

// Languages a mentor can offer a session in. A student who thinks in Hindi
// will book the Hindi mentor — this is a conversion field, not a nicety.
export const mentorLanguages = [
  "English",
  "Hindi",
  "Bengali",
  "Marathi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Punjabi",
  "Odia",
  "Assamese",
] as const;

// What a mentor can claim to have cleared — built from the exams above so
// adding an exam in one place adds it everywhere.
export const examCredentials = exams.flatMap((exam) =>
  subjects.map((subject) => `${exam.label} ${subject.label}`)
);

export const resourceCategories = [
  { slug: "institute", label: "Institute Material" },
  { slug: "books", label: "Books" },
  { slug: "test-series", label: "Test Series" },
  { slug: "pyq", label: "Previous Year Questions" },
] as const;

export type ResourceCategory = (typeof resourceCategories)[number]["slug"];

export const navLinks = [
  { href: "/mentors", label: "Mentors" },
  { href: "/resources", label: "Resources" },
  { href: "/qa", label: "Q&A" },
] as const;

// Rendered as a filled button in the navbar rather than another ghost link —
// it's the top of the funnel, not a peer of "Resources".
export const navCta = { href: "/tests", label: "Free test" } as const;

// Suggestions only (admin can still type any topic) — keeps topic tagging
// consistent across questions and mentor profiles without hardcoding a
// closed list.
export const suggestedPhysicsTopics = [
  "Mechanics",
  "Rotational Mechanics",
  "Waves & Oscillations",
  "Thermodynamics & Statistical Mechanics",
  "Electricity & Magnetism",
  "Electromagnetic Theory",
  "Optics",
  "Modern Physics",
  "Quantum Mechanics",
  "Atomic & Molecular Physics",
  "Solid State Physics",
  "Nuclear & Particle Physics",
  "Mathematical Physics",
] as const;

export const chatGptDeepLink = (question: string) =>
  `https://chat.openai.com/?q=${encodeURIComponent(question)}`;

export const jitsiRoomUrl = (shortName: string, bookingId: string) =>
  `https://meet.jit.si/${shortName}-${bookingId}`;
