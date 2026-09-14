// Deploy-time build.
//
// Vercel runs `npm run build` and nothing on the platform applies database
// migrations on its own. That gap is how the app once shipped code querying a
// column Neon did not have yet: the deploy succeeded, then every request that
// touched Booking.expiresAt threw P2022.
//
// Running `prisma migrate deploy` here ties the two together — the schema is
// migrated before the code that depends on it serves traffic, and a migration
// that fails now fails the deploy instead of leaving a half-working site.
//
// Migrations run for PRODUCTION deployments only. Preview deployments share
// DATABASE_URL with production in this project, so migrating from a preview
// would apply a pull request's schema change to the live database before it was
// merged. Previews build against whatever schema production is already on.
//
// Locally VERCEL_ENV is unset, so `npm run build` never touches a database.
// Use `npm run db:migrate` (dev) or `npm run db:deploy` (apply) by hand.

import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const target = process.env.VERCEL_ENV;

if (target === "production") {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    console.error(
      [
        "Cannot migrate: DATABASE_URL and DIRECT_URL must both be set for production builds.",
        "",
        "DIRECT_URL must be Neon's DIRECT (non-pooled) connection string — the one without",
        "'-pooler' in the hostname. Prisma Migrate issues DDL, which cannot run through the",
        "connection pooler.",
        "",
        "Set both in Vercel -> Settings -> Environment Variables (Production).",
      ].join("\n")
    );
    process.exit(1);
  }
  console.log("Applying database migrations (production deployment)…");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log(
    `Skipping migrations (VERCEL_ENV=${target ?? "unset"}) — only production deployments migrate.`
  );
}

run("npx", ["next", "build"]);
