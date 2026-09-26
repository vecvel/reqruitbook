"use server";

import { redirect } from "next/navigation";

import { type SerialisedProblem, gatewayFetch, serialiseProblem } from "@/lib/gateway";

/**
 * Company registration.
 *
 * A server action rather than a fetch from the browser, for the same reason as
 * the availability route: the gateway resolves the portal from the Host header
 * and only the server can set it. It also keeps the owner's password out of any
 * client-side request this app's own code constructs.
 *
 * Almost nothing is validated here. The DTO on the companies service, the slug
 * constraint in its database and the password policy in identity are the three
 * places that can actually decide, and their 422 carries a field map this form
 * renders verbatim. A second opinion here would be one more thing to keep in
 * step and would still not be the one that counts.
 */

export type RegisterState =
  | { status: "idle" }
  | { status: "error"; problem: SerialisedProblem; values: Record<string, string> };

interface RegistrationResult {
  companyId: string;
  slug: string;
  state: string;
  ownerAccountId: string;
  ownerCreated: boolean;
}

const TEXT_FIELDS = [
  "companyName",
  "slug",
  "ownerEmail",
  "ownerName",
  "industry",
  "size",
  "country",
] as const;

export async function registerCompany(
  _previous: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const values: Record<string, string> = {};
  for (const field of TEXT_FIELDS) {
    values[field] = String(formData.get(field) ?? "").trim();
  }

  const password = String(formData.get("ownerPassword") ?? "");

  let result: RegistrationResult;
  try {
    result = await gatewayFetch<RegistrationResult>("/api/v1/register/company", {
      method: "POST",
      body: { ...values, ownerPassword: password },
    });
  } catch (error) {
    // `values` goes back so the form redraws with everything the visitor typed.
    // The password deliberately does not: re-typing it is a small cost next to
    // round-tripping a credential through a render.
    return { status: "error", problem: attachConflictToField(serialiseProblem(error)), values };
  }

  // Only the slug and the lifecycle state travel in the URL. The owner's email
  // and the account id are personal and have no business in a query string, a
  // browser history entry or a referrer header.
  redirect(
    `/signup/company/done?slug=${encodeURIComponent(result.slug)}&state=${encodeURIComponent(result.state)}`,
  );
}

/**
 * Which input a 409 is about.
 *
 * A conflict carries a `code` and a `detail` but no field map — correctly, since
 * it is not a validation failure. The form still has to point at something: "That
 * company address is already in use" above a form of eight inputs makes the
 * reader hunt for which one. The mapping is on the codes the companies service
 * actually returns; anything else falls through to the summary alert unchanged.
 */
const CONFLICT_FIELDS: Record<string, string> = {
  slug_taken: "slug",
  email_taken: "ownerEmail",
};

function attachConflictToField(problem: SerialisedProblem): SerialisedProblem {
  const field = CONFLICT_FIELDS[problem.code];
  if (!field || problem.fieldErrors[field]) return problem;

  return {
    ...problem,
    fieldErrors: { ...problem.fieldErrors, [field]: [problem.detail] },
  };
}
