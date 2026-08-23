import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("SEED_ADMIN_EMAIL not set — skipping admin bootstrap.");
    return;
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { email: adminEmail, name: "Admin", role: "ADMIN" },
  });
  console.log(`Admin ready: ${admin.email} (sign in with Google using this email)`);

  const resourceCount = await prisma.resource.count();
  if (resourceCount === 0) {
    await prisma.resource.createMany({
      data: [
        {
          title: "Fiziks GATE Physics — Classical Mechanics Notes",
          url: "https://example.com/classical-mechanics-notes",
          category: "institute",
          subject: "physics",
          tags: ["mechanics", "gate"],
          uploadedBy: admin.id,
          featured: true,
        },
        {
          title: "Griffiths — Introduction to Electrodynamics",
          url: "https://example.com/griffiths-electrodynamics",
          category: "books",
          subject: "physics",
          tags: ["electrodynamics", "book"],
          uploadedBy: admin.id,
        },
        {
          title: "JAM Physics 2024 — Previous Year Paper",
          url: "https://example.com/jam-2024-pyq",
          category: "pyq",
          subject: "physics",
          tags: ["jam", "pyq"],
          uploadedBy: admin.id,
        },
      ],
    });
    console.log("Seeded sample resources.");
  }

  const testCount = await prisma.test.count();
  if (testCount === 0) {
    const test = await prisma.test.create({
      data: {
        slug: "jam-physics-diagnostic",
        title: "JAM Physics Diagnostic",
        subject: "physics",
        description:
          "A 15-minute diagnostic covering core JAM Physics topics. Placeholder questions — swap these for the finalized set in the admin panel.",
        durationMinutes: 15,
        published: true,
      },
    });

    await prisma.assessmentQuestion.createMany({
      data: [
        {
          testId: test.id,
          section: "PROFILE",
          topic: "year",
          prompt: "Which year are you in?",
          options: [
            { id: "a", label: "First year UG" },
            { id: "b", label: "Second year UG" },
            { id: "c", label: "Final year UG" },
            { id: "d", label: "Post-grad / repeating" },
          ],
          correctOptionIds: [],
          order: 0,
        },
        {
          testId: test.id,
          section: "PROFILE",
          topic: "prep_level",
          prompt: "How would you describe your JAM prep so far?",
          options: [
            { id: "a", label: "Just starting out" },
            { id: "b", label: "A few months in" },
            { id: "c", label: "Deep into revision" },
            { id: "d", label: "Retaking after a previous attempt" },
          ],
          correctOptionIds: [],
          order: 1,
        },
        {
          testId: test.id,
          section: "CONTENT",
          topic: "Mechanics",
          prompt:
            "A particle moves in a circle of radius $r$ at constant speed $v$. What is the direction of its acceleration?",
          options: [
            { id: "a", label: "Tangent to the circle, in the direction of motion" },
            { id: "b", label: "Directed radially outward" },
            { id: "c", label: "Directed radially inward, toward the center" },
            { id: "d", label: "Zero, since speed is constant" },
          ],
          correctOptionIds: ["c"],
          marks: 4,
          negativeMarks: 1,
          order: 2,
        },
        {
          testId: test.id,
          section: "CONTENT",
          topic: "Mechanics",
          prompt: "For a simple harmonic oscillator, the total mechanical energy is:",
          options: [
            { id: "a", label: "Maximum at the equilibrium position" },
            { id: "b", label: "Maximum at the extreme positions" },
            { id: "c", label: "Constant throughout the motion" },
            { id: "d", label: "Zero at the equilibrium position" },
          ],
          correctOptionIds: ["c"],
          marks: 4,
          negativeMarks: 1,
          order: 3,
        },
        {
          testId: test.id,
          section: "CONTENT",
          topic: "Electricity & Magnetism",
          prompt: "Inside a uniformly charged solid sphere (charge $Q$, radius $R$), the electric field at distance $r < R$ from the center is proportional to:",
          options: [
            { id: "a", label: "$1/r^2$" },
            { id: "b", label: "$r$" },
            { id: "c", label: "$1/r$" },
            { id: "d", label: "$r^2$" },
          ],
          correctOptionIds: ["b"],
          marks: 4,
          negativeMarks: 1,
          order: 4,
        },
        {
          testId: test.id,
          section: "CONTENT",
          topic: "Electricity & Magnetism",
          prompt: "A charged particle moving with velocity $\\vec{v}$ in a magnetic field $\\vec{B}$ experiences a force that is:",
          options: [
            { id: "a", label: "Parallel to $\\vec{v}$" },
            { id: "b", label: "Parallel to $\\vec{B}$" },
            { id: "c", label: "Perpendicular to both $\\vec{v}$ and $\\vec{B}$" },
            { id: "d", label: "Always zero" },
          ],
          correctOptionIds: ["c"],
          marks: 4,
          negativeMarks: 1,
          order: 5,
        },
        {
          testId: test.id,
          section: "CONTENT",
          topic: "Thermodynamics & Statistical Mechanics",
          prompt: "In a reversible adiabatic process for an ideal gas, which quantity remains constant?",
          options: [
            { id: "a", label: "Temperature" },
            { id: "b", label: "Entropy" },
            { id: "c", label: "Pressure" },
            { id: "d", label: "Volume" },
          ],
          correctOptionIds: ["b"],
          marks: 4,
          negativeMarks: 1,
          order: 6,
        },
        {
          testId: test.id,
          section: "CONTENT",
          topic: "Modern Physics",
          prompt: "In the photoelectric effect, increasing the intensity of incident light (at fixed frequency above threshold) increases:",
          options: [
            { id: "a", label: "The maximum kinetic energy of emitted electrons" },
            { id: "b", label: "The number of emitted electrons per second" },
            { id: "c", label: "The work function of the metal" },
            { id: "d", label: "The threshold frequency" },
          ],
          correctOptionIds: ["b"],
          marks: 4,
          negativeMarks: 1,
          order: 7,
        },
        {
          testId: test.id,
          section: "CONTENT",
          topic: "Mathematical Physics",
          prompt: "The Fourier series of a periodic function represents it as a sum of:",
          options: [
            { id: "a", label: "Powers of the independent variable" },
            { id: "b", label: "Sines and cosines of harmonically related frequencies" },
            { id: "c", label: "Exponentially decaying terms only" },
            { id: "d", label: "Random orthogonal polynomials" },
          ],
          correctOptionIds: ["b"],
          marks: 4,
          negativeMarks: 1,
          order: 8,
        },
      ],
    });
    console.log("Seeded JAM Physics diagnostic test with placeholder questions.");
  }

  const questionCount = await prisma.question.count();
  if (questionCount === 0) {
    const question = await prisma.question.create({
      data: {
        userId: admin.id,
        title: "Welcome — how does this Q&A work?",
        body: "Post a question with $\\LaTeX$ support like $E = mc^2$, or a block equation:\n$$\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$\nComment below to reply, and use the Ask ChatGPT button for a quick first pass.",
        subject: "physics",
        pinned: true,
      },
    });
    await prisma.comment.create({
      data: { questionId: question.id, userId: admin.id, body: "Welcome to the community!" },
    });
    console.log("Seeded a welcome question.");
  }

  const mentorProfileCount = await prisma.mentorProfile.count();
  if (mentorProfileCount === 0) {
    const dummyMentors = [
      {
        email: "ananya.mentor@example.com",
        name: "Ananya Sharma",
        institute: "IISc Bangalore",
        rank: "AIR 4, JAM Physics 2023",
        subjects: ["physics"],
        topics: ["Mechanics", "Electricity & Magnetism", "Modern Physics"],
        rate: 400,
        upiId: "ananya.mentor@upi",
        bio: "AIR 4 in JAM Physics 2023, self-study route. I focus on fixing fundamentals rather than shortcuts — most people lose marks on concepts, not tricks.",
      },
      {
        email: "rohan.mentor@example.com",
        name: "Rohan Verma",
        institute: "IIT Delhi",
        rank: "AIR 12, GATE Physics 2022",
        subjects: ["physics"],
        topics: ["Thermodynamics & Statistical Mechanics", "Mathematical Physics", "Quantum Mechanics"],
        rate: 350,
        upiId: "rohan.mentor@upi",
        bio: "Went through coaching (Fiziks) before cracking GATE. Good at breaking numerical problem-solving into a repeatable process.",
      },
    ];

    for (const m of dummyMentors) {
      const user = await prisma.user.upsert({
        where: { email: m.email },
        update: { role: "MENTOR" },
        create: { email: m.email, name: m.name, role: "MENTOR" },
      });
      await prisma.mentorProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          institute: m.institute,
          rank: m.rank,
          subjects: m.subjects,
          topics: m.topics,
          rate: m.rate,
          upiId: m.upiId,
          proofUrl: "https://example.com/placeholder-proof.pdf",
          bio: m.bio,
          verified: true,
          verifiedBy: admin.id,
          verifiedAt: new Date(),
        },
      });
    }
    console.log("Seeded dummy verified mentors.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
