import { RouteGate } from "@/components/rbac/route-gate";
import { InterviewSchedulePage } from "@/features/interviews/components/interview-schedule-page";

export default function Page() {
  return (
    <RouteGate path="/interviews/schedule">
      <InterviewSchedulePage />
    </RouteGate>
  );
}
