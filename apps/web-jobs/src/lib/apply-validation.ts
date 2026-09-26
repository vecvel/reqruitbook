import type { FormField } from "./api-types";

/**
 * Client-side checks that mirror the applications service's own.
 *
 * Nothing here is an enforcement point. The service re-validates every answer
 * against the form it fetches from the owning service at submission time, and
 * its answer is the one that counts — that is the whole reason the 422 field
 * map exists. This runs anyway because being told about an empty required
 * field before a round trip, rather than after it, is the difference between a
 * form that feels considered and one that feels like a gate.
 *
 * Where the two disagree, the server wins and its message replaces this one.
 */

export type AnswerValue = string | number | boolean | string[] | null;

export function validateAnswer(
  field: FormField,
  value: AnswerValue,
): string | undefined {
  const label = field.label || field.key;
  const blank =
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

  // A boolean is never blank: the service treats `false` as an answer, not as
  // a missing one, so a required yes/no question is satisfied by "no".
  if (blank) {
    if (field.required) return `${label} is required.`;
    return undefined;
  }

  const rules = field.validation;

  switch (field.type) {
    case "short_text":
    case "long_text":
    case "phone":
      return lengthProblem(label, String(value), rules?.minLength, rules?.maxLength);

    case "email": {
      const text = String(value).trim();
      // Deliberately loose. The server parses the address properly; a strict
      // pattern here would reject valid addresses the server accepts, which is
      // the one failure mode a client-side check must not have.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        return `${label} must be a valid email address.`;
      }
      return lengthProblem(label, text, rules?.minLength, rules?.maxLength);
    }

    case "url": {
      const text = String(value).trim();
      try {
        const parsed = new URL(text);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return `${label} must be a valid http or https link.`;
        }
      } catch {
        return `${label} must be a valid http or https link.`;
      }
      return lengthProblem(label, text, rules?.minLength, rules?.maxLength);
    }

    case "number": {
      const numeric = typeof value === "number" ? value : Number(String(value));
      if (Number.isNaN(numeric)) return `${label} must be a number.`;
      if (rules?.min !== undefined && numeric < rules.min) {
        return `${label} must be at least ${rules.min}.`;
      }
      if (rules?.max !== undefined && numeric > rules.max) {
        return `${label} must be at most ${rules.max}.`;
      }
      return undefined;
    }

    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        return `${label} must be a date in YYYY-MM-DD form.`;
      }
      return undefined;

    case "single_select": {
      const allowed = (field.options ?? []).map((option) => option.value);
      if (!allowed.includes(String(value))) {
        return `${label} must be one of the offered choices.`;
      }
      return undefined;
    }

    case "multi_select": {
      const selected = Array.isArray(value) ? value : [];
      const allowed = (field.options ?? []).map((option) => option.value);
      if (selected.some((item) => !allowed.includes(item))) {
        return `${label} must be one of the offered choices.`;
      }
      if (rules?.maxSelections && selected.length > rules.maxSelections) {
        return `${label} allows at most ${rules.maxSelections} selections.`;
      }
      return undefined;
    }

    case "file": {
      const key = String(value);
      const accepted = rules?.acceptedFileTypes ?? [];
      if (accepted.length > 0) {
        const extension = key.split(".").pop()?.toLowerCase() ?? "";
        if (!accepted.includes(extension)) {
          return `${label} must be one of: ${accepted.join(", ")}.`;
        }
      }
      return undefined;
    }

    case "boolean":
      return undefined;

    default:
      // A type this app has not been taught is left to the server, which
      // refuses it with a message of its own rather than being second-guessed.
      return undefined;
  }
}

function lengthProblem(
  label: string,
  value: string,
  minLength?: number,
  maxLength?: number,
): string | undefined {
  const length = [...value.trim()].length;
  if (minLength !== undefined && length < minLength) {
    return `${label} must be at least ${minLength} characters.`;
  }
  // 5000 is the service's own default for a form that declared no bound.
  const max = maxLength && maxLength > 0 ? maxLength : 5000;
  if (length > max) return `${label} must be at most ${max} characters.`;
  return undefined;
}

/** Drops the keys the candidate left empty, which the server treats as absent. */
export function toAnswerPayload(
  fields: FormField[],
  values: Record<string, AnswerValue>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const value = values[field.key];

    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;

    // The service types a number answer as a number and a boolean as a
    // boolean; sending the string an input produced would be refused.
    if (field.type === "number") {
      const numeric = typeof value === "number" ? value : Number(String(value));
      if (!Number.isNaN(numeric)) payload[field.key] = numeric;
      continue;
    }
    if (field.type === "boolean") {
      payload[field.key] = value === true || value === "true";
      continue;
    }

    payload[field.key] = value;
  }

  return payload;
}
