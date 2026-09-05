"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { firebaseConfigured, getFirebaseAuth } from "@/lib/firebase/client";

function firebaseErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "An account with this email already exists — try signing in instead.";
      case "auth/invalid-email":
        return "That email address doesn't look right.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect email or password.";
      case "auth/too-many-requests":
        return "Too many attempts — please wait a bit and try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}

export function EmailAuthForm({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  async function completeSignIn() {
    const idToken = await getFirebaseAuth().currentUser?.getIdToken();
    if (!idToken) throw new Error("Missing Firebase ID token");
    await signIn("firebase", { idToken, callbackUrl, redirect: true });
  }

  async function handleSignIn(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      await completeSignIn();
    } catch (error) {
      toast.error(firebaseErrorMessage(error));
      setLoading(false);
    }
  }

  async function handleSignUp(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      await sendEmailVerification(credential.user).catch(() => {});
      await completeSignIn();
    } catch (error) {
      toast.error(firebaseErrorMessage(error));
      setLoading(false);
    }
  }

  async function handleForgotPassword(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    if (!email) {
      toast.error("Enter your email above first, then click \"Forgot password?\"");
      return;
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      toast.success("Password reset email sent — check your inbox.");
    } catch (error) {
      toast.error(firebaseErrorMessage(error));
    }
  }

  if (!firebaseConfigured) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
        Email sign-in is being set up — check back soon, or use Google/Telegram below.
      </p>
    );
  }

  return (
    <Tabs value={mode} onValueChange={(value) => setMode(value as "signin" | "signup")}>
      <TabsList className="w-full">
        <TabsTrigger value="signin" className="flex-1">
          Sign in
        </TabsTrigger>
        <TabsTrigger value="signup" className="flex-1">
          Sign up
        </TabsTrigger>
      </TabsList>

      <TabsContent value="signin">
        <form action={handleSignIn} className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-email">Email</Label>
            <Input id="signin-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (form) handleForgotPassword(new FormData(form));
            }}
            className="self-end text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Forgot password?
          </button>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="signup">
        <form action={handleSignUp} className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
