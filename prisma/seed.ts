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
          "A ~25-minute diagnostic across the full JAM Physics syllabus. Conceptual, no-calculation questions that estimate how prepared you are — not a full JAM mock.",
        durationMinutes: 25,
        published: true,
      },
    });

    // PROFILE questions carry no correct answer. They're captured at submit
    // time and passed to the study-plan generator as context. `topic` is the
    // stable key the generator reads the answer back by.
    const profileQuestions = [
      {
        topic: "year",
        prompt: "Which year are you in?",
        options: [
          { id: "a", label: "First year UG" },
          { id: "b", label: "Second year UG" },
          { id: "c", label: "Final year UG" },
          { id: "d", label: "Graduated / dropper" },
        ],
      },
      {
        topic: "prep_level",
        prompt: "How would you describe your JAM prep so far?",
        options: [
          { id: "a", label: "Just starting out" },
          { id: "b", label: "A few months in" },
          { id: "c", label: "Deep into revision" },
          { id: "d", label: "Retaking after a previous attempt" },
        ],
      },
      {
        topic: "study_hours",
        prompt: "On a typical day, how much focused physics study do you actually get done?",
        options: [
          { id: "a", label: "Less than 1 hour" },
          { id: "b", label: "1–2 hours" },
          { id: "c", label: "3–4 hours" },
          { id: "d", label: "More than 4 hours" },
        ],
      },
      {
        topic: "pyq_practice",
        prompt: "Have you worked through previous years' JAM papers?",
        options: [
          { id: "a", label: "Not yet" },
          { id: "b", label: "Started — a paper or two" },
          { id: "c", label: "Several, under timed conditions" },
          { id: "d", label: "Almost all of the last 10 years" },
        ],
      },
      {
        topic: "weakest_area_self",
        prompt: "Which area do you feel least confident in right now?",
        options: [
          { id: "a", label: "Mathematical Physics" },
          { id: "b", label: "Mechanics & Oscillations" },
          { id: "c", label: "Electromagnetism & Optics" },
          { id: "d", label: "Thermodynamics, Modern & Solid State" },
        ],
      },
    ];

    // 20 CONTENT questions. See docs/assessment-jam-physics-diagnostic-v1.md
    // for the paper analysis, per-question rationale and answer key. All are
    // conceptual and answerable in under a minute without pen and paper.
    const contentQuestions = [
      {
        topic: "Mathematical Physics",
        prompt:
          "A Hermitian operator representing a physical observable is guaranteed to have:",
        options: [
          { id: "a", label: "Real eigenvalues, with eigenvectors for distinct eigenvalues orthogonal" },
          { id: "b", label: "Complex eigenvalues occurring in conjugate pairs" },
          { id: "c", label: "A determinant equal to 1" },
          { id: "d", label: "A purely imaginary trace" },
        ],
        correctOptionIds: ["a"],
      },
      {
        topic: "Mathematical Physics",
        prompt:
          "For the position vector $\\vec{r} = x\\,\\hat{x} + y\\,\\hat{y} + z\\,\\hat{z}$, the divergence $\\nabla \\cdot \\vec{r}$ in three dimensions is:",
        options: [
          { id: "a", label: "$0$" },
          { id: "b", label: "$1$" },
          { id: "c", label: "$3$" },
          { id: "d", label: "$\\hat{r}/r^2$" },
        ],
        correctOptionIds: ["c"],
      },
      {
        topic: "Mechanics",
        prompt:
          "A particle moves under a central force always directed toward a fixed point O. Which quantity is always conserved?",
        options: [
          { id: "a", label: "Its linear momentum" },
          { id: "b", label: "Its angular momentum about O" },
          { id: "c", label: "Its kinetic energy" },
          { id: "d", label: "Its speed" },
        ],
        correctOptionIds: ["b"],
      },
      {
        topic: "Rotational Mechanics",
        prompt:
          "A solid sphere and a hollow sphere of the same mass and radius are released from rest and roll without slipping down the same incline. Which reaches the bottom first?",
        options: [
          { id: "a", label: "The solid sphere" },
          { id: "b", label: "The hollow sphere" },
          { id: "c", label: "They arrive together" },
          { id: "d", label: "It depends on their mass" },
        ],
        correctOptionIds: ["a"],
      },
      {
        topic: "Waves & Oscillations",
        prompt: "In a non-dispersive medium, the group velocity of a wave packet is:",
        options: [
          { id: "a", label: "Zero" },
          { id: "b", label: "Equal to the phase velocity" },
          { id: "c", label: "Always greater than the phase velocity" },
          { id: "d", label: "Equal to the speed of light in vacuum" },
        ],
        correctOptionIds: ["b"],
      },
      {
        topic: "Optics",
        prompt:
          "Unpolarized light reflecting off a dielectric surface becomes completely linearly polarized when the angle of incidence equals the:",
        options: [
          { id: "a", label: "Critical angle" },
          { id: "b", label: "Brewster angle" },
          { id: "c", label: "Bragg angle" },
          { id: "d", label: "Grazing angle" },
        ],
        correctOptionIds: ["b"],
      },
      {
        topic: "Optics",
        prompt:
          "When light is incident at Brewster's angle on an interface, the angle between the reflected ray and the refracted ray is:",
        options: [
          { id: "a", label: "$0^\\circ$" },
          { id: "b", label: "$45^\\circ$" },
          { id: "c", label: "$90^\\circ$" },
          { id: "d", label: "$180^\\circ$" },
        ],
        correctOptionIds: ["c"],
      },
      {
        topic: "Electricity & Magnetism",
        prompt: "The net electric flux through a closed surface depends on:",
        options: [
          { id: "a", label: "Only the total charge enclosed by the surface" },
          { id: "b", label: "The enclosed charge and any nearby external charges" },
          { id: "c", label: "The shape of the surface" },
          { id: "d", label: "The positions of the charges within the surface" },
        ],
        correctOptionIds: ["a"],
      },
      {
        topic: "Electricity & Magnetism",
        prompt:
          "Just outside the surface of a charged conductor in electrostatic equilibrium, the electric field is:",
        options: [
          { id: "a", label: "Zero" },
          { id: "b", label: "Parallel to the surface" },
          { id: "c", label: "Perpendicular to the surface" },
          { id: "d", label: "At $45^\\circ$ to the surface" },
        ],
        correctOptionIds: ["c"],
      },
      {
        topic: "Electromagnetic Theory",
        prompt:
          "At a charge-free boundary between two linear dielectrics, which field components are continuous across the interface?",
        options: [
          { id: "a", label: "The tangential component of $\\vec{E}$ and the normal component of $\\vec{D}$" },
          { id: "b", label: "The normal component of $\\vec{E}$ and the tangential component of $\\vec{D}$" },
          { id: "c", label: "Both components of $\\vec{E}$" },
          { id: "d", label: "Both components of $\\vec{D}$" },
        ],
        correctOptionIds: ["a"],
      },
      {
        topic: "Thermodynamics & Statistical Mechanics",
        prompt: "The efficiency of a Carnot engine depends on:",
        options: [
          { id: "a", label: "The working substance used" },
          { id: "b", label: "Only the temperatures of the hot and cold reservoirs" },
          { id: "c", label: "The number of moles of gas" },
          { id: "d", label: "The volume at the start of the cycle" },
        ],
        correctOptionIds: ["b"],
      },
      {
        topic: "Thermodynamics & Statistical Mechanics",
        prompt:
          "For an ideal gas of rigid diatomic molecules (3 translational + 2 rotational degrees of freedom), the ratio $\\gamma = C_p/C_V$ is:",
        options: [
          { id: "a", label: "$5/3$" },
          { id: "b", label: "$7/5$" },
          { id: "c", label: "$4/3$" },
          { id: "d", label: "$3/2$" },
        ],
        correctOptionIds: ["b"],
      },
      {
        topic: "Thermodynamics & Statistical Mechanics",
        prompt:
          "An ideal gas undergoes free expansion into an evacuated chamber (rigid, insulated container). Which quantity does not change?",
        options: [
          { id: "a", label: "Temperature" },
          { id: "b", label: "Entropy" },
          { id: "c", label: "Volume" },
          { id: "d", label: "The number of accessible microstates" },
        ],
        correctOptionIds: ["a"],
      },
      {
        topic: "Modern Physics",
        prompt:
          "In the photoelectric effect, increasing the intensity of the incident light (frequency fixed, above threshold) increases:",
        options: [
          { id: "a", label: "The maximum kinetic energy of the emitted electrons" },
          { id: "b", label: "The number of electrons emitted per second" },
          { id: "c", label: "The work function of the metal" },
          { id: "d", label: "The threshold frequency" },
        ],
        correctOptionIds: ["b"],
      },
      {
        topic: "Modern Physics",
        prompt:
          "In Compton scattering, the shift in wavelength $\\Delta\\lambda$ at a fixed scattering angle:",
        options: [
          { id: "a", label: "Increases with the incident wavelength" },
          { id: "b", label: "Decreases with the incident wavelength" },
          { id: "c", label: "Is independent of the incident wavelength" },
          { id: "d", label: "Depends on the intensity of the incident radiation" },
        ],
        correctOptionIds: ["c"],
      },
      {
        topic: "Modern Physics",
        prompt:
          "Two events occur simultaneously at different locations in inertial frame S. In a second inertial frame S' moving relative to S along the line joining the events:",
        options: [
          { id: "a", label: "The events are still simultaneous" },
          { id: "b", label: "The events are, in general, not simultaneous" },
          { id: "c", label: "The events occur at the same location" },
          { id: "d", label: "One of the events does not occur at all" },
        ],
        correctOptionIds: ["b"],
      },
      {
        topic: "Quantum Mechanics",
        prompt:
          "The ground-state energy of a particle in a one-dimensional infinite square well is not zero primarily because:",
        options: [
          { id: "a", label: "The uncertainty principle forbids a confined particle from having zero momentum spread" },
          { id: "b", label: "The particle loses energy to friction with the walls" },
          { id: "c", label: "Gravitational potential energy sets a minimum" },
          { id: "d", label: "The walls are at a finite, non-zero temperature" },
        ],
        correctOptionIds: ["a"],
      },
      {
        topic: "Solid State Physics",
        prompt: "Doping pure silicon with phosphorus (a group-V element) produces:",
        options: [
          { id: "a", label: "An n-type semiconductor" },
          { id: "b", label: "A p-type semiconductor" },
          { id: "c", label: "An insulator" },
          { id: "d", label: "A superconductor" },
        ],
        correctOptionIds: ["a"],
      },
      {
        topic: "Solid State Physics",
        prompt: "The output of a two-input NAND gate is LOW only when:",
        options: [
          { id: "a", label: "Both inputs are LOW" },
          { id: "b", label: "Both inputs are HIGH" },
          { id: "c", label: "Exactly one input is HIGH" },
          { id: "d", label: "Either input is LOW" },
        ],
        correctOptionIds: ["b"],
      },
      {
        topic: "Solid State Physics",
        prompt:
          "The binding energy per nucleon peaks for nuclei near mass number $A \\approx 56$ (iron/nickel). This implies:",
        options: [
          { id: "a", label: "Energy is released both when light nuclei fuse and when heavy nuclei fission" },
          { id: "b", label: "Energy is released only in fusion, never in fission" },
          { id: "c", label: "Iron nuclei readily undergo spontaneous fission" },
          { id: "d", label: "Heavy nuclei are more tightly bound than iron" },
        ],
        correctOptionIds: ["a"],
      },
    ];

    await prisma.assessmentQuestion.createMany({
      data: [
        ...profileQuestions.map((q, i) => ({
          testId: test.id,
          section: "PROFILE" as const,
          topic: q.topic,
          prompt: q.prompt,
          options: q.options,
          correctOptionIds: [] as string[],
          order: i,
        })),
        ...contentQuestions.map((q, i) => ({
          testId: test.id,
          section: "CONTENT" as const,
          topic: q.topic,
          prompt: q.prompt,
          options: q.options,
          correctOptionIds: q.correctOptionIds,
          marks: 4,
          negativeMarks: 1,
          order: profileQuestions.length + i,
        })),
      ],
    });
    console.log(
      `Seeded JAM Physics diagnostic: ${profileQuestions.length} profile + ${contentQuestions.length} content questions.`
    );
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
