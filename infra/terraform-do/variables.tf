# =============================================================================
# DigitalOcean Credentials
# =============================================================================
variable "do_token" {
  description = "DigitalOcean Personal Access Token"
  type        = string
  sensitive   = true
}

variable "spaces_access_key" {
  description = "DigitalOcean Spaces Access Key"
  type        = string
  sensitive   = true
}

variable "spaces_secret_key" {
  description = "DigitalOcean Spaces Secret Key"
  type        = string
  sensitive   = true
}

# =============================================================================
# Project Settings
# =============================================================================
variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "fra1"
}

variable "project_name" {
  description = "Project name used for naming all resources"
  type        = string
  default     = "phygitron360"
}

variable "github_repo" {
  description = "GitHub repository (owner/repo)"
  type        = string
  default     = "cluxssy/phygitron360"
}

# =============================================================================
# Application Secrets
# =============================================================================
variable "db_password" {
  description = "Password for the PostgreSQL database user"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "Long random secret key for FastAPI JWT token signing"
  type        = string
  sensitive   = true
}

variable "superadmin_email" {
  description = "Email address for the L1 Superadmin account"
  type        = string
}

variable "superadmin_password" {
  description = "Password for the L1 Superadmin account"
  type        = string
  sensitive   = true
}

# =============================================================================
# AI / LLM Keys
# =============================================================================
variable "google_api_key" {
  description = "Google Gemini API Key for AI features"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_api_keys" {
  description = "Comma-separated list of Gemini API Keys for key pool rotation"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_rpm_limit" {
  description = "Requests-per-minute limit per Gemini API key"
  type        = string
  default     = "13"
}

variable "gemini_model" {
  description = "Gemini model name to use"
  type        = string
  default     = "gemini-3.1-flash-lite"
}

variable "gemini_fallback_model" {
  description = "Fallback Gemini model(s) when primary model hits 503/429/404"
  type        = string
  default     = "gemini-2.5-flash,gemini-2.5-flash-lite,gemini-3.5-flash-lite"
}

variable "groq_api_key" {
  description = "Groq API Key (for bulk parsing)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "groq_api_keys" {
  description = "Comma-separated list of Groq API Keys for key pool rotation"
  type        = string
  sensitive   = true
  default     = ""
}

variable "groq_model" {
  description = "Groq model name to use"
  type        = string
  default     = "openai/gpt-oss-20b"
}

variable "groq_fallback_models" {
  description = "Fallback Groq models when primary model fails"
  type        = string
  default     = "qwen/qwen3.8-27b,openai/gpt-oss-120b"
}

variable "groq_rpm_limit" {
  description = "Requests-per-minute limit for Groq"
  type        = string
  default     = "25"
}

variable "openai_api_key" {
  description = "OpenAI API Key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ai_provider" {
  description = "Primary AI provider (gemini | groq | openai | mock)"
  type        = string
  default     = "gemini"
}

variable "bulk_ai_provider" {
  description = "AI provider used for bulk resume parsing (groq | gemini | openai | mock)"
  type        = string
  default     = "groq"
}

variable "bulk_parse_workers" {
  description = "Number of parallel AI workers for bulk parsing"
  type        = string
  default     = "3"
}

# =============================================================================
# Branding
# =============================================================================
variable "sender_name" {
  description = "Name shown in the From field of all sent emails"
  type        = string
  default     = "EWANDZ Digital HR"
}

variable "company_name" {
  description = "Company name used in email templates and branding"
  type        = string
  default     = "EWANDZ Digital"
}

# =============================================================================
# SMTP Email Settings
# =============================================================================
variable "smtp_host" {
  description = "SMTP Host for sending emails"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP Port"
  type        = string
  default     = "587"
}

variable "smtp_user" {
  description = "SMTP Username"
  type        = string
  default     = ""
}

variable "smtp_pass" {
  description = "SMTP Password"
  type        = string
  sensitive   = true
  default     = ""
}
