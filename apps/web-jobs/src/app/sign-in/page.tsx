import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";
import { readIdentity } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  // Someone already signed in has nothing to do on this page.
  if (await readIdentity()) redirect("/");

  return (
    <div className="mx-auto w-full max-w-sm space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to apply, track your applications and read your messages.
        </p>
      </div>

      {/* useSearchParams needs a boundary so the rest of the page can still be
          prerendered. */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AuthForm mode="sign-in" />
      </Suspense>
    </div>
  );
}
