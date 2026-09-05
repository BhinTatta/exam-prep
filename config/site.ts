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

export const resourceCategories = [
  { slug: "institute", label: "Institute Material" },
  { slug: "books", label: "Books" },
  { slug: "test-series", label: "Test Series" },
  { slug: "pyq", label: "Previous Year Questions" },
] as const;

export type ResourceCategory = (typeof resourceCategories)[number]["slug"];

export const navLinks = [
  { href: "/resources", label: "Resources" },
  { href: "/qa", label: "Q&A" },
  { href: "/mentors", label: "Mentors" },
  { href: "/tests", label: "Diagnostic Test" },
] as const;

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
