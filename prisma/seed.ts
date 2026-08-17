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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
