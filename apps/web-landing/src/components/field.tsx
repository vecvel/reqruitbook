import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * A labelled input with its error wired to it.
 *
 * The wiring is the point. `aria-describedby` and `aria-invalid` have to name
 * the message for a screen reader to reach it, and doing that by hand at eight
 * call sites is how one of them ends up with a red message nobody hears.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  describedBy: extraDescribedBy,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string | undefined;
  required?: boolean;
  /** Ids of anything else that explains this input, e.g. a live status line. */
  describedBy?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
    required: boolean | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [errorId, extraDescribedBy, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
        required,
      })}

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
