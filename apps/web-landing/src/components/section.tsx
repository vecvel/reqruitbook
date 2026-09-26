import { cn } from "@/lib/utils";

/** The one content column every page uses, so the four portals line up. */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function Section({
  title,
  lead,
  id,
  className,
  children,
}: {
  title?: string;
  lead?: string;
  id?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("py-14 sm:py-20", className)}>
      <Container>
        {title ? (
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl">{title}</h2>
            {lead ? <p className="mt-3 text-muted-foreground">{lead}</p> : null}
          </div>
        ) : null}
        {children ? <div className={title ? "mt-10" : undefined}>{children}</div> : null}
      </Container>
    </section>
  );
}
