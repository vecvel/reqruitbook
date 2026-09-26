// Package migrations embeds the notifications service's SQL migrations.
package migrations

import "embed"

// FS holds the numbered migration files, applied in filename order.
//
//go:embed *.sql
var FS embed.FS
