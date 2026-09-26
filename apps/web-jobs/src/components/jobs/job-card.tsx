import Link from "next/link";
import { Building2, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { JobSummary } from "@/lib/api-types";
import {
  employmentTypeLabel,
  formatRelative,
  formatSalaryRange,
  seniorityLabel,
  workModeLabel,
} from "@/lib/format";

export function JobCard({ job }: { job: JobSummary }) {
  const salary = formatSalaryRange(job.salary);
  const locations = job.locations.filter(Boolean);

  return (
    // `relative` plus the title link's ::after is what makes the whole card
    // clickable without wrapping non-link content in an anchor.
    <article className="surface relative p-4 transition-colors hover:bg-muted/40">
      <h2 className="text-base font-semibold tracking-tight">
        <Link
          href={`/jobs/${job.slug}`}
          className="after:absolute after:inset-0 hover:text-accent"
        >
          {job.title}
        </Link>
      </h2>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {job.department ? (
          <span className="inline-flex items-center gap-1.5">
            <Building2 aria-hidden="true" className="size-3.5" />
            {job.department}
          </span>
        ) : null}
        {locations.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-3.5" />
            {locations.join(", ")}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="soft-neutral">{workModeLabel(job.workMode)}</Badge>
        <Badge variant="soft-neutral">
          {employmentTypeLabel(job.employmentType)}
        </Badge>
        <Badge variant="soft-neutral">{seniorityLabel(job.seniority)}</Badge>
        {/* The band shows only when the company chose to publish it — the
            service omits it entirely otherwise, so there is nothing to hide. */}
        {salary ? <Badge variant="soft-accent">{salary}</Badge> : null}
      </div>

      {job.publishedAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Posted {formatRelative(job.publishedAt)}
        </p>
      ) : null}
    </article>
  );
}
