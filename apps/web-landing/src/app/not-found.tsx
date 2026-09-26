import Link from "next/link";

import { Container } from "@/components/section";
import { Button } from "@/components/ui/button";
import { JOBS_PORTAL_URL } from "@/lib/env";

export default function NotFound() {
  return (
    <Container className="max-w-xl py-24">
      <p className="section-title">404</p>
      <h1 className="mt-2 text-3xl">There is nothing at this address</h1>
      <p className="mt-3 text-muted-foreground">
        If you were looking for a company&rsquo;s careers page, it lives on that
        company&rsquo;s own address rather than under a path here.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="accent">
          <Link href="/">Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/signin">Find your portal</Link>
        </Button>
        <Button asChild variant="ghost">
          <a href={JOBS_PORTAL_URL}>Find a job</a>
        </Button>
      </div>
    </Container>
  );
}
