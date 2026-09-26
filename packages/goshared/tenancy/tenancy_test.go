package tenancy

import (
	"errors"
	"testing"
)

func TestPrincipalRequireCompany(t *testing.T) {
	company := Principal{Type: PrincipalCompany, Subject: "acc_1", CompanyID: "co_1"}
	got, err := company.RequireCompany()
	if err != nil || got != "co_1" {
		t.Fatalf("RequireCompany() = %q, %v; want co_1, nil", got, err)
	}

	// A company principal without a tenant must never resolve to one.
	orphan := Principal{Type: PrincipalCompany, Subject: "acc_1"}
	if _, err := orphan.RequireCompany(); !errors.Is(err, ErrNotCompanyScoped) {
		t.Fatalf("orphaned company principal error = %v, want ErrNotCompanyScoped", err)
	}

	candidate := Principal{Type: PrincipalCandidate, Subject: "acc_2"}
	if _, err := candidate.RequireCompany(); !errors.Is(err, ErrNotCompanyScoped) {
		t.Fatalf("candidate error = %v, want ErrNotCompanyScoped", err)
	}
}

func TestPrincipalAssertCompany(t *testing.T) {
	principal := Principal{Type: PrincipalCompany, Subject: "acc_1", CompanyID: "co_1"}

	if err := principal.AssertCompany("co_1"); err != nil {
		t.Fatalf("same tenant should be allowed, got %v", err)
	}
	if err := principal.AssertCompany("co_2"); !errors.Is(err, ErrCrossTenant) {
		t.Fatalf("cross-tenant error = %v, want ErrCrossTenant", err)
	}
}

// Platform staff operate the platform; they are deliberately not granted a
// tenant's permissions just by being administrators.
func TestPlatformAdminHasNoImplicitTenantPermissions(t *testing.T) {
	admin := Principal{Type: PrincipalPlatform, Subject: "acc_admin"}

	if admin.Can("jobs.read") {
		t.Error("platform admin should not implicitly hold company permissions")
	}
	if _, err := admin.RequireCompany(); !errors.Is(err, ErrNotCompanyScoped) {
		t.Errorf("platform admin should not resolve to a company, got %v", err)
	}
}

func TestAnonymousIsNotAuthenticated(t *testing.T) {
	if Anonymous().IsAuthenticated() {
		t.Error("anonymous principal must not be authenticated")
	}
	if Anonymous().Can("jobs.read") {
		t.Error("anonymous principal must hold no permissions")
	}
}
