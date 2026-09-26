"use client";

import { FieldError } from "@/components/feedback";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormField } from "@/lib/api-types";
import type { AnswerValue } from "@/lib/apply-validation";

/**
 * Renders one question from a company's application form.
 *
 * Every branch produces a real, labelled control: a `<label for>` tied to an
 * id, `aria-describedby` pointing at the help text and the error, and
 * `aria-invalid` when the field failed. A form a recruiter authored can be
 * twenty questions long, and a candidate on a screen reader should be able to
 * tell which one they are on and which one was rejected.
 */
export function ApplicationFormField({
  field,
  value,
  error,
  disabled,
  onChange,
  fileSlot,
}: {
  field: FormField;
  value: AnswerValue;
  error?: string;
  disabled?: boolean;
  onChange: (value: AnswerValue) => void;
  /** A `file` question's control, supplied by the form that owns the résumés. */
  fileSlot?: React.ReactNode;
}) {
  const id = `field-${field.key}`;
  const helpId = field.helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const invalid = Boolean(error);

  const common = {
    id,
    name: field.key,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    disabled,
    required: field.required,
  };

  return (
    <div className="space-y-1.5">
      {/* A boolean's label belongs beside its checkbox, not above it. */}
      {field.type === "boolean" ? null : (
        <Label htmlFor={id}>
          {field.label}
          {field.required ? (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
          {field.required ? <span className="sr-only"> (required)</span> : null}
        </Label>
      )}

      {renderControl()}

      {field.helpText ? (
        <p id={helpId} className="text-xs text-muted-foreground">
          {field.helpText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId}>
          <FieldError message={error} />
        </p>
      ) : null}
    </div>
  );

  function renderControl() {
    switch (field.type) {
      case "long_text":
        return (
          <Textarea
            {...common}
            rows={5}
            maxLength={field.validation?.maxLength}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        );

      case "number":
        return (
          <Input
            {...common}
            type="number"
            min={field.validation?.min}
            max={field.validation?.max}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(event) => onChange(event.target.value)}
          />
        );

      case "date":
        return (
          <Input
            {...common}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        );

      case "email":
        return (
          <Input
            {...common}
            type="email"
            autoComplete="email"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        );

      case "phone":
        return (
          <Input
            {...common}
            type="tel"
            autoComplete="tel"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        );

      case "url":
        return (
          <Input
            {...common}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        );

      case "single_select":
        // A native select rather than a styled listbox: it is correct with a
        // keyboard and a screen reader on every platform without this app
        // having to reimplement any of that.
        return (
          <select
            {...common}
            className="flex h-10 w-full rounded-xs border border-input bg-transparent px-3 text-sm aria-invalid:border-destructive"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">Choose…</option>
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label || option.value}
              </option>
            ))}
          </select>
        );

      case "multi_select": {
        const selected = Array.isArray(value) ? value : [];
        const cap = field.validation?.maxSelections ?? 0;
        return (
          <fieldset
            className="space-y-2 rounded-xs border border-input p-3"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          >
            <legend className="sr-only">{field.label}</legend>
            {(field.options ?? []).map((option) => {
              const checked = selected.includes(option.value);
              // Disabling the unchecked options at the cap is how the limit is
              // communicated before it is hit, rather than through an error
              // after the fact.
              const atCap = cap > 0 && !checked && selected.length >= cap;
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled || atCap}
                    onCheckedChange={(next) => {
                      onChange(
                        next === true
                          ? [...selected, option.value]
                          : selected.filter((item) => item !== option.value),
                      );
                    }}
                  />
                  {option.label || option.value}
                </label>
              );
            })}
            {cap > 0 ? (
              <p className="text-xs text-muted-foreground">
                Choose up to {cap}.
              </p>
            ) : null}
          </fieldset>
        );
      }

      case "boolean":
        return (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              id={id}
              checked={value === true}
              disabled={disabled}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onCheckedChange={(next) => onChange(next === true)}
            />
            <span>
              {field.label}
              {field.required ? (
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              ) : null}
            </span>
          </label>
        );

      case "file":
        return (
          fileSlot ?? (
            <p className="text-sm text-muted-foreground">
              This question needs a file upload, which is not available here.
            </p>
          )
        );

      case "short_text":
      default:
        return (
          <Input
            {...common}
            type="text"
            maxLength={field.validation?.maxLength}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        );
    }
  }
}
