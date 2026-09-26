"use client";

import { useEffect } from "react";

import { Container } from "@/components/section";
import { Button } from "@/components/ui/button";

/**
 * The last resort, not the usual path.
 *
 * Anything the gateway said is rendered where it happened — the pricing grid
 * and the sign-up form both catch their own ProblemError and show its `detail`.
 * Reaching here means this app threw, which is a bug in this app and not
 * something a visitor can act on, so it says so plainly and offers a retry.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[web-landing] unhandled render error", error);
  }, [error]);

  return (
    <Container className="max-w-xl py-24">
      <h1 className="text-3xl">This page did not load</h1>
      <p className="mt-3 text-muted-foreground">
        Something broke on our side. It is not something you did, and trying again
        often works.
      </p>
      {error.digest ? (
        <p className="mt-4 text-sm text-muted-foreground">
          If you report this, quote <span className="tabular">{error.digest}</span>.
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="accent" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <a href="/">Back to the home page</a>
        </Button>
      </div>
    </Container>
  );
}
