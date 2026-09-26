import type { Resume } from "./api-types";

/**
 * WORKAROUND — the storage key of a résumé, reconstructed.
 *
 * `POST /api/v1/public/apply` takes a `resumeKey`, and a `file` question on an
 * application form is answered with an object key too. But nothing the
 * candidates service returns contains that key: `GET /api/v1/me/resumes` and
 * the upload ticket both answer with a `resumeView`, which carries id,
 * filename, contentType, size and isPrimary — and no `objectKey`.
 *
 * So the key is rebuilt here from the layout the service documents in
 * `services/candidates/internal/domain/domain.go` (`ResumeObjectKey`):
 *
 *     candidate/<accountId>/<resumeId><ext>
 *
 * This is the wrong place for that knowledge. A front end reproducing a
 * service's internal storage layout will break silently the day the layout
 * changes — the apply call would simply start failing validation with a key
 * that points at nothing. It is confined to this one function so that the fix
 * is a one-line change once `resumeView` carries the key, and it is reported
 * as a gap rather than left to be discovered.
 *
 * `extractKeyFromUploadUrl` is preferred wherever it can be used, because it
 * reads the key the service actually signed rather than guessing at it.
 */

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

export function resumeObjectKey(accountId: string, resume: Resume): string | null {
  const extension = EXTENSION_BY_CONTENT_TYPE[resume.contentType.toLowerCase()];
  if (!accountId || !extension) return null;
  return `candidate/${accountId}/${resume.id}${extension}`;
}

/**
 * Reads the object key out of a presigned PUT URL.
 *
 * The signed URL is `<endpoint>/<bucket>/<key>?X-Amz-...`, so the key is
 * everything after the bucket segment. This is the key the service itself
 * produced, which makes it the truthful answer whenever an upload just
 * happened.
 */
export function extractKeyFromUploadUrl(uploadUrl: string): string | null {
  try {
    const url = new URL(uploadUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    // The first segment is the bucket under the path-style addressing MinIO
    // uses locally; everything after it is the key.
    const key = segments.slice(1).join("/");
    return key.startsWith("candidate/") ? decodeURIComponent(key) : null;
  } catch {
    return null;
  }
}
