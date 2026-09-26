import type { PermissionKey } from "./types";

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHENTICATED";
  readonly status = 401;

  constructor(message = "You must be signed in to perform this action.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  readonly status = 403;
  readonly required: PermissionKey[];
  readonly mode: "any" | "all";

  constructor(required: PermissionKey[], mode: "any" | "all" = "any", message?: string) {
    super(
      message ??
        `Access denied. This action requires ${
          mode === "all" ? "all of" : "one of"
        }: ${required.join(", ")}.`,
    );
    this.name = "ForbiddenError";
    this.required = required;
    this.mode = mode;
  }
}

export class FeatureDisabledError extends Error {
  readonly code = "FEATURE_DISABLED";
  readonly status = 403;
  readonly featureKey: string;

  constructor(featureKey: string, featureName?: string) {
    super(`The ${featureName ?? featureKey} module is disabled for this organization.`);
    this.name = "FeatureDisabledError";
    this.featureKey = featureKey;
  }
}

export function isAuthorizationError(
  error: unknown,
): error is UnauthorizedError | ForbiddenError | FeatureDisabledError {
  return (
    error instanceof UnauthorizedError ||
    error instanceof ForbiddenError ||
    error instanceof FeatureDisabledError
  );
}
