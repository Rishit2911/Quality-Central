# =============================================================================
# Managed PostgreSQL Database
# Production-grade with automated daily backups.
# $15/month — 1 vCPU, 1GB RAM, 10GB SSD
# =============================================================================
resource "digitalocean_database_cluster" "postgres" {
  name       = "${var.project_name}-db"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1

  tags = [var.project_name]
}

# =============================================================================
# Managed Redis (for Celery Task Queue)
# $15/month — 1 vCPU, 1GB RAM
# =============================================================================
resource "digitalocean_database_cluster" "redis" {
  name       = "${var.project_name}-redis"
  engine     = "valkey"
  version    = "8"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1

  tags = [var.project_name]
}

# =============================================================================
# Database Firewall Rules
# Restricts PostgreSQL and Redis access to ONLY the App Platform.
# Blocks all public internet access to the databases.
# =============================================================================
resource "digitalocean_database_firewall" "postgres_fw" {
  cluster_id = digitalocean_database_cluster.postgres.id

  rule {
    type  = "app"
    value = digitalocean_app.phygitron.id
  }
}

resource "digitalocean_database_firewall" "redis_fw" {
  cluster_id = digitalocean_database_cluster.redis.id

  rule {
    type  = "app"
    value = digitalocean_app.phygitron.id
  }
}
