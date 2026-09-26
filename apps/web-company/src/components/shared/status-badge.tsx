import { Badge, type BadgeProps } from "@/components/ui/badge";
import { humanise } from "@/lib/format";

type Tone = NonNullable<BadgeProps["variant"]>;

const TONES: Record<string, Tone> = {
  /* Generic */
  active: "soft-success",
  inactive: "soft-neutral",
  pending: "soft-warning",
  archived: "soft-neutral",
  draft: "soft-neutral",
  completed: "soft-success",
  approved: "soft-success",
  rejected: "soft-destructive",
  expired: "soft-destructive",
  cancelled: "soft-destructive",

  /* Recruitment Pipeline & Stages */
  applied: "soft-neutral",
  screening: "soft-accent",
  shortlisted: "soft-accent",
  interview: "soft-accent",
  evaluation: "soft-warning",
  selected: "soft-success",
  offered: "soft-success",
  hired: "soft-success",
  declined: "soft-destructive",

  /* Job Statuses */
  published: "soft-success",
  open: "soft-success",
  on_hold: "soft-warning",
  closed: "soft-neutral",

  /* Interview Statuses */
  scheduled: "soft-accent",
  confirmed: "soft-accent",
  rescheduled: "soft-warning",
  no_show: "soft-destructive",

  /* Offers */
  pending_approval: "soft-warning",
  sent: "soft-accent",
  accepted: "soft-success",
  withdrawn: "soft-destructive",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const normalized = status.toLowerCase().replace(/[\s-]+/g, "_");
  const tone = TONES[normalized] ?? "soft-neutral";
  return (
    <Badge variant={tone} className={className}>
      {label ?? humanise(status)}
    </Badge>
  );
}
