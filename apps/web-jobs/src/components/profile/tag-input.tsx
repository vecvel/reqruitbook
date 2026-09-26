"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A list of short values — skills, languages — entered one at a time.
 *
 * Each entry gets its own remove button rather than being edited inside one
 * comma-separated string, because a mistyped comma in that design silently
 * merges two skills into one and there is no way to tell from looking at it.
 */
export function TagInput({
  id,
  label,
  values,
  placeholder,
  helpText,
  onChange,
}: {
  id: string;
  label: string;
  values: string[];
  placeholder?: string;
  helpText?: string;
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    // Case-insensitive, because "React" and "react" are one skill.
    if (!values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value]);
    }
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        aria-describedby={`${id}-help`}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add();
          }
          // Backspace on an empty box removes the last entry, which is what
          // every tag field people have used already does.
          if (event.key === "Backspace" && draft === "" && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={add}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {helpText ?? "Press Enter or comma to add each one."}
      </p>

      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {values.map((value) => (
            <li key={value}>
              <span className="inline-flex items-center gap-1 rounded-xs border border-border bg-muted/60 py-0.5 pl-2 pr-1 text-xs">
                {value}
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  className="rounded-xs p-0.5 hover:bg-border"
                  onClick={() =>
                    onChange(values.filter((existing) => existing !== value))
                  }
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
