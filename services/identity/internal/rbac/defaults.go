package rbac

// DefaultRole describes a role the platform seeds for a new scope.
type DefaultRole struct {
	Slug         string
	Name         string
	Description  string
	Badge        string
	IsSuperAdmin bool
	IsSystem     bool
	// Permissions is ignored when IsSuperAdmin is set: that role always holds
	// everything in its scope, so there is no list to drift out of date.
	Permissions []string
}

// PlatformRoles are seeded once, for the root administration console.
func PlatformRoles() []DefaultRole {
	return []DefaultRole{
		{
			Slug:         "super_admin",
			Name:         "Super Admin",
			Description:  "Unrestricted access to every platform feature and action.",
			Badge:        "Super Admin",
			IsSuperAdmin: true,
			IsSystem:     true,
		},
		{
			Slug:        "operations",
			Name:        "Operations",
			Description: "Company onboarding, subscriptions, and day-to-day platform operations.",
			Badge:       "Operations",
			IsSystem:    true,
			Permissions: []string{
				"platform_companies.read", "platform_companies.update",
				"platform_companies.approve", "platform_companies.suspend",
				"platform_candidates.read",
				"plans.read",
				"subscriptions.read", "subscriptions.update", "subscriptions.override",
				"payments.read",
				"platform_support.read", "platform_support.reply",
				"platform_support.assign", "platform_support.close",
				"platform_audit.read",
			},
		},
		{
			Slug:        "support",
			Name:        "Support",
			Description: "Answer company support tickets and inspect account state.",
			Badge:       "Support",
			IsSystem:    true,
			Permissions: []string{
				"platform_companies.read",
				"platform_candidates.read",
				"subscriptions.read",
				"payments.read",
				"platform_support.read", "platform_support.reply", "platform_support.assign",
			},
		},
		{
			Slug:        "finance",
			Name:        "Finance",
			Description: "Plans, subscriptions, payments, and refunds.",
			Badge:       "Finance",
			IsSystem:    true,
			Permissions: []string{
				"platform_companies.read",
				"plans.create", "plans.read", "plans.update", "plans.delete", "plans.publish",
				"subscriptions.read", "subscriptions.update", "subscriptions.override",
				"payments.read", "payments.refund", "payments.configure",
				"platform_audit.read",
			},
		},
		{
			Slug:        "read_only",
			Name:        "Read Only",
			Description: "View platform state without making changes.",
			Badge:       "Read Only",
			IsSystem:    true,
			Permissions: []string{
				"platform_companies.read", "platform_candidates.read",
				"plans.read", "subscriptions.read", "payments.read",
				"platform_support.read", "platform_audit.read",
			},
		},
	}
}

// CompanyRoles are seeded into every new company account.
//
// A company can rename these, re-permission them, or add its own; the Owner role
// is the exception, since removing the only unrestricted role would lock the
// company out of its own portal.
func CompanyRoles() []DefaultRole {
	return []DefaultRole{
		{
			Slug:         "owner",
			Name:         "Owner",
			Description:  "Unrestricted access to every feature in this company account.",
			Badge:        "Owner",
			IsSuperAdmin: true,
			IsSystem:     true,
		},
		{
			Slug:        "hiring_admin",
			Name:        "Hiring Administrator",
			Description: "Runs recruitment end to end and manages the team.",
			Badge:       "Admin",
			IsSystem:    true,
			Permissions: append(recruiterPermissions(),
				"recruiters.create", "recruiters.read", "recruiters.update",
				"recruiters.invite", "recruiters.assign_roles", "recruiters.manage_status",
				"company_roles.read",
				"company_profile.read", "company_profile.update",
				"company_audit.read",
				"support.read", "support.create", "support.reply",
				"jobs.delete", "applications.delete", "candidates.delete",
				"offers.approve", "offers.delete",
				"messaging.read_all",
			),
		},
		{
			Slug:        "recruiter",
			Name:        "Recruiter",
			Description: "Owns requisitions, pipeline progression, and candidate conversations.",
			Badge:       "Recruiter",
			IsSystem:    true,
			Permissions: recruiterPermissions(),
		},
		{
			Slug:        "hiring_manager",
			Name:        "Hiring Manager",
			Description: "Reviews candidates for their team and approves offers.",
			Badge:       "Hiring Lead",
			IsSystem:    true,
			Permissions: []string{
				"jobs.read",
				"applications.read", "applications.advance_stage",
				"candidates.read", "candidates.download_resume",
				"interviews.read", "interviews.submit_scorecard", "interviews.view_scorecards",
				"offers.read", "offers.approve", "offers.view_compensation",
				"reports.read",
			},
		},
		{
			Slug:        "interviewer",
			Name:        "Interviewer",
			Description: "Participates in assigned panels and submits scorecards.",
			Badge:       "Interviewer",
			IsSystem:    true,
			Permissions: []string{
				"jobs.read",
				"applications.read",
				"candidates.read",
				"interviews.read", "interviews.submit_scorecard",
			},
		},
	}
}

func recruiterPermissions() []string {
	return []string{
		"jobs.create", "jobs.read", "jobs.update",
		"jobs.publish_portal", "jobs.publish_network", "jobs.manage_form",
		"jobs.duplicate", "jobs.export",
		"applications.create", "applications.read", "applications.update",
		"applications.advance_stage", "applications.reject",
		"applications.bulk_update", "applications.export",
		"candidates.create", "candidates.read", "candidates.update",
		"candidates.download_resume", "candidates.export",
		"talent_search.search", "talent_search.approach",
		"interviews.create", "interviews.read", "interviews.update",
		"interviews.submit_scorecard", "interviews.view_scorecards",
		"offers.create", "offers.read", "offers.update",
		"offers.send", "offers.view_compensation",
		"messaging.read", "messaging.send",
		"reports.read",
		"company_profile.read",
		"support.read", "support.create",
	}
}

// CandidateRole is the single role every candidate account holds. Candidates do
// not have configurable roles: their capabilities are fixed by the product.
func CandidateRole() DefaultRole {
	return DefaultRole{
		Slug:        "candidate",
		Name:        "Candidate",
		Description: "Manage a profile, apply to jobs, and talk to recruiters.",
		Badge:       "Candidate",
		IsSystem:    true,
		Permissions: PermissionsForScope(ScopeCandidate),
	}
}

// Resolve expands a role definition into the permission list it grants.
func (r DefaultRole) Resolve(scope Scope) []string {
	if r.IsSuperAdmin {
		return PermissionsForScope(scope)
	}
	return Sanitize(scope, r.Permissions)
}
