# =============================================================================
# DigitalOcean App Platform
# Hosts all 3 application components:
#   1. Frontend  — React static site (FREE)
#   2. Backend   — FastAPI web server ($25/mo, 1 vCPU, 2GB RAM)
#   3. Worker    — Celery background task processor ($10/mo, 1 vCPU, 1GB RAM)
#
# App Platform automatically handles:
#   - Load balancing
#   - HTTPS / SSL certificates
#   - Zero-downtime deployments
#   - Auto-deploy on every push to 'main'
# =============================================================================
resource "digitalocean_app" "phygitron" {
  spec {
    name   = var.project_name
    region = "fra"

    # ------------------------------------------------------------------
    # Custom Domains
    # After terraform apply, point these CNAMEs in GoDaddy to:
    #   <app-name>.ondigitalocean.app
    # ------------------------------------------------------------------
    domain {
      name     = "phygitron.com"
      type     = "PRIMARY"
      zone     = "phygitron.com"
      wildcard = true
    }

    domain {
      name = "www.phygitron.com"
      type = "ALIAS"
    }

    # ------------------------------------------------------------------
    # 1. FRONTEND — React/Vite Static Site (FREE)
    # Built by DigitalOcean from GitHub and served via global CDN.
    # ------------------------------------------------------------------
    static_site {
      name = "frontend"

      github {
        repo           = var.github_repo
        branch         = "main"
        deploy_on_push = true
      }

      source_dir        = "frontend"
      build_command     = "npm install && npm run build"
      output_dir        = "dist"
      catchall_document = "index.html"
    }

    # ------------------------------------------------------------------
    # 2. BACKEND — FastAPI Web Service ($25/mo)
    # Handles all API calls, authentication, and business logic.
    # ------------------------------------------------------------------
    service {
      name               = "backend"
      instance_count     = 1
      instance_size_slug = "apps-s-1vcpu-2gb"

      github {
        repo           = var.github_repo
        branch         = "main"
        deploy_on_push = true
      }

      dockerfile_path = "backend/Dockerfile"
      run_command     = "sh -c 'uvicorn backend.main:app --host 0.0.0.0 --port $${PORT:-8000} --workers 1'"
      source_dir      = "backend"
      http_port       = 8000



      health_check {
        http_path             = "/api/health"
        initial_delay_seconds = 60
      }

      # ---- Database Connection ----
      env {
        key   = "DB_HOST"
        value = digitalocean_database_cluster.postgres.host
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "DB_PORT"
        value = tostring(digitalocean_database_cluster.postgres.port)
        scope = "RUN_TIME"
      }
      env {
        key   = "DB_NAME"
        value = digitalocean_database_cluster.postgres.database
        scope = "RUN_TIME"
      }
      env {
        key   = "DB_USER"
        value = digitalocean_database_cluster.postgres.user
        scope = "RUN_TIME"
      }
      env {
        key   = "DB_PASSWORD"
        value = digitalocean_database_cluster.postgres.password
        scope = "RUN_TIME"
        type  = "SECRET"
      }

      # Required for DO Managed Postgres
      env {
        key   = "PGSSLMODE"
        value = "require"
        scope = "RUN_TIME"
      }

      # ---- Redis (Celery Broker) ----
      env {
        key   = "REDIS_URL"
        value = "rediss://${digitalocean_database_cluster.redis.user}:${digitalocean_database_cluster.redis.password}@${digitalocean_database_cluster.redis.host}:${digitalocean_database_cluster.redis.port}/0?ssl_cert_reqs=none"
        scope = "RUN_TIME"
        type  = "SECRET"
      }

      # ---- App Security ----
      env {
        key   = "SECRET_KEY"
        value = var.secret_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }

      # ---- Superadmin Seed ----
      env {
        key   = "SUPERADMIN_EMAIL"
        value = var.superadmin_email
        scope = "RUN_TIME"
      }
      env {
        key   = "SUPERADMIN_PASSWORD"
        value = var.superadmin_password
        scope = "RUN_TIME"
        type  = "SECRET"
      }

      # ---- AI / LLM ----
      env {
        key   = "AI_PROVIDER"
        value = var.ai_provider
        scope = "RUN_TIME"
      }
      env {
        key   = "GEMINI_MODEL"
        value = var.gemini_model
        scope = "RUN_TIME"
      }
      env {
        key   = "GEMINI_FALLBACK_MODEL"
        value = var.gemini_fallback_model
        scope = "RUN_TIME"
      }
      env {
        key   = "GEMINI_RPM_LIMIT"
        value = var.gemini_rpm_limit
        scope = "RUN_TIME"
      }
      env {
        key   = "GEMINI_API_KEYS"
        value = var.gemini_api_keys
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "GOOGLE_API_KEY"
        value = var.google_api_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "GROQ_API_KEY"
        value = var.groq_api_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "GROQ_API_KEYS"
        value = var.groq_api_keys
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "GROQ_MODEL"
        value = var.groq_model
        scope = "RUN_TIME"
      }
      env {
        key   = "GROQ_FALLBACK_MODELS"
        value = var.groq_fallback_models
        scope = "RUN_TIME"
      }
      env {
        key   = "GROQ_RPM_LIMIT"
        value = var.groq_rpm_limit
        scope = "RUN_TIME"
      }
      env {
        key   = "OPENAI_API_KEY"
        value = var.openai_api_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "BULK_AI_PROVIDER"
        value = var.bulk_ai_provider
        scope = "RUN_TIME"
      }
      env {
        key   = "BULK_PARSE_WORKERS"
        value = var.bulk_parse_workers
        scope = "RUN_TIME"
      }

      # ---- DO Spaces (S3-compatible file storage) ----
      env {
        key   = "AWS_ACCESS_KEY_ID"
        value = var.spaces_access_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "AWS_SECRET_ACCESS_KEY"
        value = var.spaces_secret_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "AWS_S3_ENDPOINT_URL"
        value = "https://fra1.digitaloceanspaces.com"
        scope = "RUN_TIME"
      }
      env {
        key   = "AWS_S3_BUCKET_NAME"
        value = digitalocean_spaces_bucket.uploads.name
        scope = "RUN_TIME"
      }
      env {
        key   = "AWS_DEFAULT_REGION"
        value = "fra1"
        scope = "RUN_TIME"
      }

      # ---- SMTP Email ----
      env {
        key   = "SMTP_HOST"
        value = var.smtp_host
        scope = "RUN_TIME"
      }
      env {
        key   = "SMTP_PORT"
        value = var.smtp_port
        scope = "RUN_TIME"
      }
      env {
        key   = "SMTP_USER"
        value = var.smtp_user
        scope = "RUN_TIME"
      }
      env {
        key   = "SMTP_PASS"
        value = var.smtp_pass
        scope = "RUN_TIME"
        type  = "SECRET"
      }

      env {
        key   = "SENDER_NAME"
        value = var.sender_name
        scope = "RUN_TIME"
      }
      env {
        key   = "COMPANY_NAME"
        value = var.company_name
        scope = "RUN_TIME"
      }

      # ---- App URL ----
      env {
        key   = "APP_BASE_URL"
        value = "https://phygitron.com"
        scope = "RUN_TIME"
      }
    }

    # ------------------------------------------------------------------
    # 3. CELERY WORKER — Background Task Processor ($10/mo)
    # Runs the exact same Docker image as the backend but executes the
    # Celery worker command instead of Uvicorn.
    # Handles: ATS scoring, auto-ranking, bulk resume parsing.
    # ------------------------------------------------------------------
    worker {
      name               = "celery-worker"
      instance_count     = 1
      instance_size_slug = "apps-s-1vcpu-1gb"

      github {
        repo           = var.github_repo
        branch         = "dev"
        deploy_on_push = true
      }

      dockerfile_path = "backend/Dockerfile"
      source_dir      = "backend"
      run_command     = "celery -A backend.core.celery_app worker --loglevel=info --concurrency=4"

      # The worker needs the same environment variables as the backend
      # (DB connection, Redis, AI keys, and Spaces for file access)

      env {
        key   = "DB_HOST"
        value = digitalocean_database_cluster.postgres.host
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "DB_PORT"
        value = tostring(digitalocean_database_cluster.postgres.port)
        scope = "RUN_TIME"
      }
      env {
        key   = "DB_NAME"
        value = digitalocean_database_cluster.postgres.database
        scope = "RUN_TIME"
      }
      env {
        key   = "DB_USER"
        value = digitalocean_database_cluster.postgres.user
        scope = "RUN_TIME"
      }
      env {
        key   = "DB_PASSWORD"
        value = digitalocean_database_cluster.postgres.password
        scope = "RUN_TIME"
        type  = "SECRET"
      }

      # Required for DO Managed Postgres
      env {
        key   = "PGSSLMODE"
        value = "require"
        scope = "RUN_TIME"
      }
      env {
        key   = "REDIS_URL"
        value = "rediss://${digitalocean_database_cluster.redis.user}:${digitalocean_database_cluster.redis.password}@${digitalocean_database_cluster.redis.host}:${digitalocean_database_cluster.redis.port}/0?ssl_cert_reqs=none"
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "AI_PROVIDER"
        value = var.ai_provider
        scope = "RUN_TIME"
      }
      env {
        key   = "GEMINI_MODEL"
        value = var.gemini_model
        scope = "RUN_TIME"
      }
      env {
        key   = "GEMINI_FALLBACK_MODEL"
        value = var.gemini_fallback_model
        scope = "RUN_TIME"
      }
      env {
        key   = "GEMINI_RPM_LIMIT"
        value = var.gemini_rpm_limit
        scope = "RUN_TIME"
      }
      env {
        key   = "GEMINI_API_KEYS"
        value = var.gemini_api_keys
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "GOOGLE_API_KEY"
        value = var.google_api_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "GROQ_API_KEY"
        value = var.groq_api_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "GROQ_API_KEYS"
        value = var.groq_api_keys
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "GROQ_MODEL"
        value = var.groq_model
        scope = "RUN_TIME"
      }
      env {
        key   = "GROQ_FALLBACK_MODELS"
        value = var.groq_fallback_models
        scope = "RUN_TIME"
      }
      env {
        key   = "GROQ_RPM_LIMIT"
        value = var.groq_rpm_limit
        scope = "RUN_TIME"
      }
      env {
        key   = "OPENAI_API_KEY"
        value = var.openai_api_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "BULK_AI_PROVIDER"
        value = var.bulk_ai_provider
        scope = "RUN_TIME"
      }
      env {
        key   = "BULK_PARSE_WORKERS"
        value = var.bulk_parse_workers
        scope = "RUN_TIME"
      }
      env {
        key   = "SENDER_NAME"
        value = var.sender_name
        scope = "RUN_TIME"
      }
      env {
        key   = "COMPANY_NAME"
        value = var.company_name
        scope = "RUN_TIME"
      }
      env {
        key   = "AWS_ACCESS_KEY_ID"
        value = var.spaces_access_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "AWS_SECRET_ACCESS_KEY"
        value = var.spaces_secret_key
        scope = "RUN_TIME"
        type  = "SECRET"
      }
      env {
        key   = "AWS_S3_ENDPOINT_URL"
        value = "https://fra1.digitaloceanspaces.com"
        scope = "RUN_TIME"
      }
      env {
        key   = "AWS_S3_BUCKET_NAME"
        value = digitalocean_spaces_bucket.uploads.name
        scope = "RUN_TIME"
      }
      env {
        key   = "AWS_DEFAULT_REGION"
        value = "fra1"
        scope = "RUN_TIME"
      }
    }

    ingress {
      rule {
        component {
          name = "frontend"
        }
        match {
          path {
            prefix = "/"
          }
        }
      }
      rule {
        component {
          name                 = "backend"
          preserve_path_prefix = true
        }
        match {
          path {
            prefix = "/api"
          }
        }
      }
      rule {
        component {
          name                 = "backend"
          preserve_path_prefix = true
        }
        match {
          path {
            prefix = "/docs"
          }
        }
      }
      rule {
        component {
          name                 = "backend"
          preserve_path_prefix = true
        }
        match {
          path {
            prefix = "/openapi.json"
          }
        }
      }
      rule {
        component {
          name                 = "backend"
          preserve_path_prefix = true
        }
        match {
          path {
            prefix = "/uploads"
          }
        }
      }
    }
  }
}
