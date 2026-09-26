import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";
import { readIdentity } from "@/lib/session";

export const metadata = { title: "Create an account" };

export default async function RegisterPage() {
  if (await readIdentity()) redirect("/");

  return (
    <div className="mx-auto w-full max-w-sm space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Create your candidate account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One profile and one résumé, reusable at every company hiring on the
          network.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}
