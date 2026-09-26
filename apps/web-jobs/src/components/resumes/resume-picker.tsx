"use client";

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";

import { ProblemAlert } from "@/components/feedback";
import {
  RESUME_ACCEPT,
  useResumes,
} from "@/components/resumes/use-resumes";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatDate } from "@/lib/format";
import { resumeObjectKey } from "@/lib/resume-key";

/**
 * Picks an existing résumé or uploads a new one, and reports the object key.
 *
 * The key is what the application actually carries — the service stores a
 * pointer into object storage, not the bytes. See lib/resume-key.ts for why
 * reconstructing it here is a workaround rather than a design.
 */
export function ResumePicker({
  selectedKey,
  onSelect,
  labelledBy,
}: {
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  labelledBy?: string;
}) {
  const { session } = useSession();
  const { resumes, loading, uploading, error, upload } = useResumes();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);

  const accountId = session?.accountId ?? "";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    try {
      const result = await upload(file);
      const key = result.objectKey ?? resumeObjectKey(accountId, result.resume);
      onSelect(key);
    } catch (cause) {
      setUploadError(cause);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }

  return (
    <div className="space-y-3" role="group" aria-labelledby={labelledBy}>
      {error ? <ProblemAlert error={error} /> : null}
      {uploadError ? <ProblemAlert error={uploadError} /> : null}

      {resumes.length > 0 ? (
        <ul className="space-y-2">
          {resumes.map((resume) => {
            const key = resumeObjectKey(accountId, resume);
            const selected = key !== null && key === selectedKey;
            return (
              <li key={resume.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xs border p-3 text-sm transition-colors ${
                    selected
                      ? "border-accent bg-accent/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="resume"
                    className="size-4 accent-[hsl(var(--accent))]"
                    checked={selected}
                    disabled={key === null}
                    onChange={() => onSelect(key)}
                  />
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {resume.filename}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatBytes(resume.sizeBytes)} · added{" "}
                      {formatDate(resume.createdAt)}
                      {resume.isPrimary ? " · primary" : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          You have not added a résumé yet.
        </p>
      )}

      <div>
        <input
          ref={fileInput}
          type="file"
          accept={RESUME_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            // Clearing the value means picking the same file twice still fires
            // a change event, which is the obvious thing to do after a failure.
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden="true" />
          {uploading ? "Uploading…" : "Upload a new résumé"}
        </Button>
        <p className="mt-1.5 text-xs text-muted-foreground">
          PDF, DOC or DOCX. The file goes straight to storage — it never passes
          through this site.
        </p>
      </div>
    </div>
  );
}
