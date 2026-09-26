// Package migrations embeds the applications service's SQL migrations.
package migrations

import "embed"

// FS holds the numbered migration files, applied in filename order.
//
//go:embed *.sql
var FS embed.FS
