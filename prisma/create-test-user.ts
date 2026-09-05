import { PrismaClient } from "@prisma/client";
import { getFirebaseAdminAuth } from "../src/lib/firebase/admin";

// One-off script to provision the Razorpay QA login — run with
// `npm run db:create-test-user`. Requires FIREBASE_PROJECT_ID,
// FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to be set (see .env.example).
//
// The password is never stored in our database: Firebase's Admin SDK hashes
// and stores it in the Firebase project itself, same as any user created via
// the email/password sign-up form (src/components/auth/email-auth-form.tsx).
const TEST_USERS = [{ email: "razorpaytest@test.com", password: "Asdf.1234", name: "Razorpay Test" }];

const prisma = new PrismaClient();

async function main() {
  const firebaseAdminAuth = getFirebaseAdminAuth();
  for (const { email, password, name } of TEST_USERS) {
    const firebaseUser = await firebaseAdminAuth
      .getUserByEmail(email)
      .catch(() => firebaseAdminAuth.createUser({ email, password, emailVerified: true, displayName: name }));

    const user = await prisma.user.upsert({
      where: { firebaseUid: firebaseUser.uid },
      update: { email, emailVerified: new Date(), name },
      create: { firebaseUid: firebaseUser.uid, email, emailVerified: new Date(), name },
    });

    console.log(`Test user ready: ${user.email} / ${password}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
