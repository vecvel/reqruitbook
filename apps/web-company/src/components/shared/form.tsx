"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Submit button that reflects the enclosing form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className} {...props}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}

/** Labelled field wrapper with consistent spacing and error presentation. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string | string[];
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const messages = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="text-xs font-medium text-foreground"
        >
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && messages.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
      {messages.map((m) => (
        <p key={m} className="text-[11px] font-medium text-destructive">
          {m}
        </p>
      ))}
    </div>
  );
}

/** Displays a server action's or form's error message above a form. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xs border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
      {message}
    </div>
  );
}
