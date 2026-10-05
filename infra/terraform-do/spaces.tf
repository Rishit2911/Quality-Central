# =============================================================================
# DO Spaces Bucket — S3-Compatible File Storage
# Stores all user uploads: resumes, profile pictures, generated PDFs, etc.
# $5/month — includes 250GB storage and 1TB outbound bandwidth.
#
# NOTE: Your existing backend boto3 code does NOT need to change.
# We simply point it at the DO Spaces endpoint instead of AWS S3.
# =============================================================================
resource "digitalocean_spaces_bucket" "uploads" {
  name   = "${var.project_name}-uploads"
  region = "fra1"
  acl    = "private"

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = [
      "https://phygitron.com",
      "https://www.phygitron.com",
      "https://*.phygitron.com"
    ]
    max_age_seconds = 3000
  }
}
