package rbac

import (
	"strings"
	"testing"
)

// Every permission key must be `<feature>.<action>`; the whole platform parses
// them on that assumption.
func TestPermissionKeyFormat(t *testing.T) {
	for _, permission := range Permissions() {
		feature, action, found := strings.Cut(permission.Key, ".")
		if !found || feature == "" || action == "" {
			t.Errorf("permission %q is not in <feature>.<action> form", permission.Key)
		}
		if feature != permission.FeatureKey {
			t.Errorf("permission %q does not match its feature %q", permission.Key, permission.FeatureKey)
		}
	}
}

func TestSanitizeDropsUnknownAndOutOfScopeKeys(t *testing.T) {
	got := Sanitize(ScopeCompany, []string{
		"jobs.read",           // valid
		"jobs.read",           // duplicate
		"jobs.nonexistent",    // unknown action
		"nonexistent.read",    // unknown feature
		"plans.create",        // valid key, but platform scope
		"  candidates.read  ", // whitespace is trimmed
	})

	want := []string{"candidates.read", "jobs.read"}
	if len(got) != len(want) {
		t.Fatalf("Sanitize() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("Sanitize() = %v, want %v", got, want)
		}
	}
}

// A platform role must never be able to carry a company permission: that is the
// boundary keeping support staff out of customer data.
func TestScopesDoNotOverlap(t *testing.T) {
	platform := map[string]struct{}{}
	for _, key := range PermissionsForScope(ScopePlatform) {
		platform[key] = struct{}{}
	}

	for _, key := range PermissionsForScope(ScopeCompany) {
		if _, clash := platform[key]; clash {
			t.Errorf("permission %q exists in both the platform and company scopes", key)
		}
	}
}

func TestSubsetReportsMissingPermissions(t *testing.T) {
	held := []string{"jobs.read", "jobs.create"}

	if missing := Subset(held, []string{"jobs.read"}); len(missing) != 0 {
		t.Errorf("Subset() = %v, want none missing", missing)
	}

	missing := Subset(held, []string{"jobs.read", "jobs.delete", "offers.approve"})
	if len(missing) != 2 {
		t.Fatalf("Subset() = %v, want 2 missing", missing)
	}
}

// A super-admin role is defined as "everything in its scope", so it must expand
// to the full catalogue rather than a list that can fall behind.
func TestSuperAdminRolesResolveToEveryPermissionInScope(t *testing.T) {
	for _, role := range PlatformRoles() {
		if !role.IsSuperAdmin {
			continue
		}
		if len(role.Resolve(ScopePlatform)) != len(PermissionsForScope(ScopePlatform)) {
			t.Error("platform super admin does not hold every platform permission")
		}
	}

	for _, role := range CompanyRoles() {
		if !role.IsSuperAdmin {
			continue
		}
		if len(role.Resolve(ScopeCompany)) != len(PermissionsForScope(ScopeCompany)) {
			t.Error("company owner does not hold every company permission")
		}
	}
}

// Seeded roles are written straight into the database; a typo in one would
// silently grant nothing.
func TestDefaultRolesReferenceRealPermissions(t *testing.T) {
	check := func(scope Scope, roles []DefaultRole) {
		for _, role := range roles {
			if role.IsSuperAdmin {
				continue
			}
			for _, key := range role.Permissions {
				permission, known := Lookup(key)
				if !known {
					t.Errorf("role %q references unknown permission %q", role.Slug, key)
					continue
				}
				if permission.Scope != scope {
					t.Errorf("role %q references %q from the %q scope", role.Slug, key, permission.Scope)
				}
			}
		}
	}

	check(ScopePlatform, PlatformRoles())
	check(ScopeCompany, CompanyRoles())
}
