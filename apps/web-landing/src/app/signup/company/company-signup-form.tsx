"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Loader2, X } from "lucide-react";

import { Field } from "@/components/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type SlugCheckResult, normaliseSlug, slugProblem, suggestSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { type RegisterState, registerCompany } from "./actions";

const INITIAL: RegisterState = { status: "idle" };

/** Fixed rather than useId, because the input has to name it in aria-describedby. */
const SLUG_STATUS_ID = "slug-status";

/** Kept in step with COMPANY_SIZES in services/companies/src/companies/domain.ts. */
const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5000+",
] as const;

export function CompanySignUpForm({ portalHost }: { portalHost: string }) {
  const [state, formAction] = useActionState(registerCompany, INITIAL);
  const problem = state.status === "error" ? state.problem : null;
  const previous = state.status === "error" ? state.values : undefined;

  const [companyName, setCompanyName] = useState(previous?.companyName ?? "");
  const [slug, setSlug] = useState(previous?.slug ?? "");
  // Once the visitor edits the address themselves, the company name stops
  // driving it. Overwriting a deliberate choice on the next keystroke is the
  // classic way this pattern becomes infuriating.
  const [slugTouched, setSlugTouched] = useState(Boolean(previous?.slug));

  const effectiveSlug = slugTouched ? slug : suggestSlug(companyName);
  const check = useSlugAvailability(effectiveSlug);

  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A rejected submit scrolls back up and announces itself; otherwise the
    // page looks like nothing happened.
    if (problem) summaryRef.current?.focus();
  }, [problem]);

  const slugFieldError = problem?.fieldErrors.slug?.[0];

  return (
    // No `noValidate`: the browser catching an empty required field saves a
    // pointless round trip, and every field this form marks required really is.
    // It does not replace the server's answer — the 422 below is what decides.
    <form action={formAction} className="flex flex-col gap-6">
      {problem ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          // The problem+json `detail` is written for a person. Rendering it is
          // the whole reason the services bother to produce one.
          className="outline-none"
        >
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" className="size-4" />
            <AlertTitle>{summaryTitle(problem)}</AlertTitle>
            <AlertDescription>
              <p>{problem.detail}</p>
              {Object.keys(problem.fieldErrors).length > 0 ? (
                <p className="mt-1 text-xs">Details are shown beside each field below.</p>
              ) : null}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-5 border-0 p-0">
        <legend className="section-title mb-1">Your company</legend>

        <Field
          id="companyName"
          label="Company name"
          required
          error={problem?.fieldErrors.companyName?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="companyName"
              autoComplete="organization"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          )}
        </Field>

        <Field
          id="slug"
          label="Company address"
          required
          error={slugFieldError}
          // The status line is hidden once the server has ruled on the slug.
          describedBy={slugFieldError ? undefined : SLUG_STATUS_ID}
          hint={
            <>
              This becomes your careers portal and the address your team signs in at.
              Lowercase letters, numbers and hyphens. It cannot be changed later.
            </>
          }
        >
          {(props) => (
            <>
              <div className="flex items-stretch">
                <Input
                  {...props}
                  name="slug"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={40}
                  className="rounded-r-none"
                  value={effectiveSlug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(normaliseSlug(event.target.value));
                  }}
                />
                <span
                  aria-hidden="true"
                  className="inline-flex shrink-0 items-center border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground"
                >
                  .{portalHost}
                </span>
              </div>
              <SlugStatusLine
                slug={effectiveSlug}
                portalHost={portalHost}
                check={check}
                suppressed={Boolean(slugFieldError)}
              />
            </>
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="industry"
            label="Industry"
            required
            error={problem?.fieldErrors.industry?.[0]}
          >
            {(props) => (
              <Input
                {...props}
                name="industry"
                defaultValue={previous?.industry ?? ""}
                placeholder="Software, logistics, healthcare…"
              />
            )}
          </Field>

          <Field id="size" label="Team size" required error={problem?.fieldErrors.size?.[0]}>
            {(props) => (
              <select
                {...props}
                name="size"
                defaultValue={previous?.size ?? ""}
                className="h-10 w-full rounded-xs border border-input bg-transparent px-3 text-sm"
              >
                <option value="" disabled>
                  Select a range
                </option>
                {COMPANY_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} people
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field id="country" label="Country" required error={problem?.fieldErrors.country?.[0]}>
          {(props) => (
            <Input
              {...props}
              name="country"
              autoComplete="country-name"
              defaultValue={previous?.country ?? ""}
            />
          )}
        </Field>
      </fieldset>

      <hr className="border-border" />

      <fieldset className="flex flex-col gap-5 border-0 p-0">
        <legend className="section-title mb-1">Your owner account</legend>
        <p className="-mt-2 text-sm text-muted-foreground">
          This account owns the company and can invite everyone else. You will sign in
          at{" "}
          <span className="tabular">
            {effectiveSlug || "your-company"}.{portalHost}
          </span>
          , not here.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="ownerName"
            label="Your name"
            required
            error={problem?.fieldErrors.ownerName?.[0]}
          >
            {(props) => (
              <Input
                {...props}
                name="ownerName"
                autoComplete="name"
                defaultValue={previous?.ownerName ?? ""}
              />
            )}
          </Field>

          <Field
            id="ownerEmail"
            label="Work email"
            required
            error={problem?.fieldErrors.ownerEmail?.[0]}
          >
            {(props) => (
              <Input
                {...props}
                name="ownerEmail"
                type="email"
                autoComplete="email"
                defaultValue={previous?.ownerEmail ?? ""}
              />
            )}
          </Field>
        </div>

        <Field
          id="ownerPassword"
          label="Password"
          required
          error={problem?.fieldErrors.ownerPassword?.[0]}
          hint="At least 12 characters. Your password is never shown back to you, so you will need to re-enter it if anything else on this form is rejected."
        >
          {(props) => (
            <Input
              {...props}
              name="ownerPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
            />
          )}
        </Field>
      </fieldset>

      <div className="flex flex-col gap-3">
        <SubmitButton />
        <p className="text-xs text-muted-foreground">
          By creating an account you agree to our{" "}
          <a href="/legal/terms" className="underline underline-offset-4">
            terms
          </a>{" "}
          and{" "}
          <a href="/legal/privacy" className="underline underline-offset-4">
            privacy notice
          </a>
          .
        </p>
      </div>
    </form>
  );
}

/**
 * A heading a person can read, above the server's own words.
 *
 * `problem.title` is the HTTP reason phrase — "Conflict", "Unprocessable
 * Entity" — which is accurate and useless at the top of a form. The `detail`
 * underneath it is still the server's, verbatim; only this line is ours.
 */
function summaryTitle(problem: { status: number; title: string }): string {
  if (problem.status === 422) return "Please check the form";
  if (problem.status === 409) return "That could not be saved";
  if (problem.status === 429) return "Too many attempts";
  if (problem.status === 0 || problem.status >= 500) return "We could not reach the server";
  return problem.title;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin" />
          Creating your company…
        </>
      ) : (
        "Create company account"
      )}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Live availability                                                          */
/* -------------------------------------------------------------------------- */

type CheckState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "done"; result: SlugCheckResult };

/**
 * Asks whether an address is free, without asking on every keystroke.
 *
 * Debounced because the endpoint behind this is deliberately rate limited — it
 * would otherwise enumerate every tenant on the platform — and because a
 * half-typed name is not a question worth asking. A 429 is not an error to
 * show: it means back off, so the hook does, and the form falls back to letting
 * the submit decide.
 */
function useSlugAvailability(slug: string): CheckState {
  const [state, setState] = useState<CheckState>({ phase: "idle" });
  const backoffUntil = useRef(0);

  useEffect(() => {
    if (slug.length === 0 || slugProblem(slug) !== null) {
      setState({ phase: "idle" });
      return;
    }
    if (Date.now() < backoffUntil.current) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState({ phase: "checking" });
      fetch(`/api/slug-available?slug=${encodeURIComponent(slug)}`, {
        signal: controller.signal,
      })
        .then((response) => response.json() as Promise<SlugCheckResult>)
        .then((result) => {
          if (result.retryAfter) {
            backoffUntil.current = Date.now() + result.retryAfter * 1000;
          }
          setState({ phase: "done", result });
        })
        .catch((error: unknown) => {
          // An abort is the next keystroke arriving, not a failure.
          if (error instanceof DOMException && error.name === "AbortError") return;
          setState({
            phase: "done",
            result: {
              slug,
              status: "unknown",
              reason: "We could not check this address just now.",
            },
          });
        });
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slug]);

  return state;
}

function SlugStatusLine({
  slug,
  portalHost,
  check,
  suppressed,
}: {
  slug: string;
  portalHost: string;
  check: CheckState;
  suppressed: boolean;
}) {
  const local = slug.length > 0 ? slugProblem(slug) : null;

  // The server's own verdict on the last submit outranks anything this line
  // could say; showing both would be two answers to one question.
  if (suppressed) return null;

  if (slug.length === 0) {
    return (
      <p id={SLUG_STATUS_ID} className="text-sm text-muted-foreground">
        Your portal will be at <span className="tabular">your-company.{portalHost}</span>
      </p>
    );
  }

  const preview = (
    <span className="tabular font-medium">
      {slug}.{portalHost}
    </span>
  );

  let icon: React.ReactNode = null;
  let message: React.ReactNode = <>Your portal will be at {preview}</>;
  let tone = "text-muted-foreground";

  if (local) {
    icon = <X aria-hidden="true" className="size-4 shrink-0" />;
    message = local;
    tone = "text-destructive";
  } else if (check.phase === "checking") {
    icon = <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />;
    message = <>Checking {preview}…</>;
  } else if (check.phase === "done" && check.result.slug === slug) {
    if (check.result.status === "available") {
      icon = <Check aria-hidden="true" className="size-4 shrink-0" />;
      message = <>{preview} is available</>;
      tone = "text-sage-deep";
    } else if (check.result.status === "unavailable") {
      icon = <X aria-hidden="true" className="size-4 shrink-0" />;
      message = check.result.reason ?? "That company address is not available.";
      tone = "text-destructive";
    } else {
      message = (
        <>
          Your portal will be at {preview}. {check.result.reason}
        </>
      );
    }
  }

  return (
    <p
      id={SLUG_STATUS_ID}
      // Announced as it settles rather than on every intermediate state, so a
      // screen reader hears the answer and not the typing.
      aria-live="polite"
      className={cn("flex items-start gap-1.5 text-sm", tone)}
    >
      {icon}
      <span>{message}</span>
    </p>
  );
}
