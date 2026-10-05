# =============================================================================
# Outputs — Printed after every successful terraform apply
# =============================================================================

output "app_live_url" {
  description = "The DigitalOcean App Platform default URL (before custom domain is live)"
  value       = digitalocean_app.phygitron.live_url
}

output "app_id" {
  description = "App Platform App ID"
  value       = digitalocean_app.phygitron.id
}

output "spaces_bucket_name" {
  description = "DO Spaces bucket name for file uploads"
  value       = digitalocean_spaces_bucket.uploads.name
}

output "spaces_bucket_domain" {
  description = "DO Spaces bucket domain for direct file access"
  value       = digitalocean_spaces_bucket.uploads.bucket_domain_name
}

output "postgres_host" {
  description = "PostgreSQL public host (for migrations and admin access)"
  value       = digitalocean_database_cluster.postgres.host
  sensitive   = true
}

output "postgres_port" {
  description = "PostgreSQL port"
  value       = digitalocean_database_cluster.postgres.port
}

output "postgres_database" {
  description = "PostgreSQL default database name"
  value       = digitalocean_database_cluster.postgres.database
}

output "postgres_user" {
  description = "PostgreSQL admin username"
  value       = digitalocean_database_cluster.postgres.user
}

output "postgres_password" {
  description = "PostgreSQL admin password"
  value       = digitalocean_database_cluster.postgres.password
  sensitive   = true
}

output "redis_host" {
  description = "Redis host"
  value       = digitalocean_database_cluster.redis.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = digitalocean_database_cluster.redis.port
}
