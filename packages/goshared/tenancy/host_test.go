package tenancy

import "testing"

func TestResolveHost(t *testing.T) {
	const platform = "reqruitbook.com"

	tests := []struct {
		name        string
		host        string
		wantPortal  Portal
		wantCompany string
	}{
		{"apex is the public site", "reqruitbook.com", PortalPublic, ""},
		{"www is the public site", "www.reqruitbook.com", PortalPublic, ""},
		{"root is the admin console", "root.reqruitbook.com", PortalRoot, ""},
		{"admin is an alias for root", "admin.reqruitbook.com", PortalRoot, ""},
		{"jobs is the candidate portal", "jobs.reqruitbook.com", PortalJobs, ""},
		{"a slug is a company portal", "acme.reqruitbook.com", PortalCompany, "acme"},
		{"a port is ignored", "acme.reqruitbook.com:8080", PortalCompany, "acme"},
		{"case is normalized", "ACME.ReqruitBook.com", PortalCompany, "acme"},
		{"a trailing dot is ignored", "acme.reqruitbook.com.", PortalCompany, "acme"},
		{"a foreign host falls back to public", "evil.example.com", PortalPublic, ""},
		{"an empty host falls back to public", "", PortalPublic, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ResolveHost(tc.host, platform)
			if got.Portal != tc.wantPortal {
				t.Errorf("portal = %q, want %q", got.Portal, tc.wantPortal)
			}
			if got.CompanySlug != tc.wantCompany {
				t.Errorf("company slug = %q, want %q", got.CompanySlug, tc.wantCompany)
			}
		})
	}
}

// A nested subdomain must not be able to impersonate a reserved portal by
// hiding it deeper in the host.
func TestResolveHostIgnoresNestedLabels(t *testing.T) {
	got := ResolveHost("evil.root.reqruitbook.com", "reqruitbook.com")
	if got.Portal != PortalRoot {
		t.Fatalf("portal = %q, want %q", got.Portal, PortalRoot)
	}
	if got.CompanySlug != "" {
		t.Fatalf("company slug = %q, want empty", got.CompanySlug)
	}
}

func TestReservedSlugs(t *testing.T) {
	for _, slug := range []string{"root", "jobs", "api", "admin", "www"} {
		if !IsReservedSlug(slug) {
			t.Errorf("%q should be reserved", slug)
		}
	}
	if IsReservedSlug("acme-corp") {
		t.Error("acme-corp should not be reserved")
	}
}
