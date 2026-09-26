import { ApplicationsList } from "@/components/applications/applications-list";
import { PageHeader } from "@/components/feedback";
import { requireIdentity } from "@/lib/guard";

export const metadata = { title: "My applications" };

export default async function ApplicationsPage() {
  await requireIdentity("/applications");

  return (
    <div className="page">
      <PageHeader
        title="My applications"
        description="Every role you have applied for, and the stage each one has reached. Stage names are the employer's own."
      />
      <ApplicationsList />
    </div>
  );
}
