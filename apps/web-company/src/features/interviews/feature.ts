import { defineFeature } from "@/lib/rbac/define";

export const interviewsFeature = defineFeature({
  key: "interviews",
  name: "Interviews & Panels",
  description: "Calendar scheduling, interview rounds, and evaluation scorecards",
  icon: "CalendarDays",
  group: "recruitment",
  order: 5,
  crud: true,
  actions: [
    {
      action: "submit_scorecard",
      label: "Submit Interview Scorecards",
      description: "Record structured ratings and notes for a round",
    },
    {
      action: "view_scorecards",
      label: "View All Scorecards",
      description: "Read panel feedback submitted by other interviewers",
      sensitive: true,
    },
  ],
  nav: [
    {
      label: "Interviews",
      href: "/interviews",
      icon: "CalendarDays",
      badgeKey: "interviewsToday",
      requires: ["interviews.read", "interviews.submit_scorecard"],
      children: [
        { label: "Calendar View", href: "/interviews" },
        { label: "Upcoming Rounds", href: "/interviews?view=upcoming" },
        { label: "Completed", href: "/interviews?view=completed" },
        { label: "Pending Feedback", href: "/interviews?view=feedback", badgeKey: "pendingFeedback" },
        {
          label: "+ Schedule Round",
          href: "/interviews/schedule",
          requires: ["interviews.create"],
        },
      ],
    },
  ],
  routes: [
    { path: "/interviews/schedule", exact: true, requires: ["interviews.create"] },
    { path: "/interviews", requires: ["interviews.read", "interviews.submit_scorecard"] },
  ],
});
