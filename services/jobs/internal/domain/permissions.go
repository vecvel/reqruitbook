package domain

// Permission keys this service guards with.
//
// They are declared in `services/identity/internal/rbac/registry.go` and only
// mirrored here so a typo is a compile error at one call site rather than a
// string literal repeated across the routing table.
const (
	PermissionCreate         = "jobs.create"
	PermissionRead           = "jobs.read"
	PermissionUpdate         = "jobs.update"
	PermissionDelete         = "jobs.delete"
	PermissionDuplicate      = "jobs.duplicate"
	PermissionExport         = "jobs.export"
	PermissionManageForm     = "jobs.manage_form"
	PermissionPublishPortal  = "jobs.publish_portal"
	PermissionPublishNetwork = "jobs.publish_network"
)
