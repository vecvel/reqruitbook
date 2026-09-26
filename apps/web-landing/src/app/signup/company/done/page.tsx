import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Container } from "@/components/section";
import { Button } from "@/components/ui/button";
import { PORTAL_HOST, companyPortalUrl } from "@/lib/env";
import { slugProblem } from "@/lib/slug";

export const metadata: Metadata = {
  title: "Company registered",
  robots: { index: false },
};

/**
 * The confirmation after a successful registration.
 *
 * It reads the slug from the URL, which is fine — a careers-portal address is
 * public by construction. The owner's email and account id are not in the URL
 * on purpose: a query string ends up in history, in a referrer header and in
 * whatever the visitor pastes into a chat window.
 *
 * The slug is validated again before it is used to build a link, because
 * anything in a URL arrived from outside.
 */
export default async function RegistrationDonePage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; state?: string }>;
}) {
  const params = await searchParams;
  const slug = params.slug && slugProblem(params.slug) === null ? params.slug : null;
  const pendingReview = params.state === "pending_review";

  return (
    <Container className="max-w-2xl py-16 sm:py-24">
      <CheckCircle2 aria-hidden="true" className="size-10 text-sage-deep" />
      <h1 className="mt-5 text-3xl">Your company is registered</h1>

      {slug ? (
        <p className="mt-4 text-muted-foreground">
          Your careers portal address is{" "}
          <span className="tabular font-medium text-foreground">
            {slug}.{PORTAL_HOST}
          </span>
          .
        </p>
      ) : (
        <p className="mt-4 text-muted-foreground">
          Check your email for your company&rsquo;s address.
        </p>
      )}

      <div className="mt-8 rounded-xs border border-border bg-muted/40 p-6">
        <h2 className="text-base">
          {pendingReview ? "Waiting on review" : "What happens next"}
        </h2>
        {pendingReview ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every new company is reviewed by the platform team before its portal opens.
            Until that is done, signing in will be refused — that is the review, not a
            problem with your account. We will email the owner address as soon as it
            clears.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sign in at your own address with the owner account you just created, choose
            a plan, and invite your team.
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {slug ? (
          <Button asChild variant="accent">
            <a href={companyPortalUrl(slug)}>Go to {slug}.{PORTAL_HOST}</a>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/pricing">See plans</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">Back to the home page</Link>
        </Button>
      </div>
    </Container>
  );
}
