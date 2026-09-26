#!/bin/bash
# Creates one database per service on first container start.
#
# Service-per-database keeps data ownership explicit: a service can only reach its
# own tables, so a cross-service join is impossible by construction rather than by
# convention.
set -euo pipefail

for db in $(echo "${SERVICE_DATABASES}" | tr ',' ' '); do
  echo "Creating database: ${db}"
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname postgres <<-SQL
    SELECT 'CREATE DATABASE "${db}"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db}')\gexec
SQL
done

echo "Service databases ready."
