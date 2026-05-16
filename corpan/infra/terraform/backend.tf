terraform {
  backend "s3" {
    bucket  = "corpan-tf-state"
    key     = "corpan-prod/terraform.tfstate"
    region  = "us-east-2"
    encrypt = true
  }
}

# Backing bucket (`corpan-tf-state`) is created out-of-band — terraform can't
# bootstrap its own backend. Hardened on creation:
#   - versioning enabled (state rollback)
#   - SSE-S3 (AES256) default encryption
#   - block-public-access on all four toggles
#   - IAM read/write granted only via the terraform-admin user (~/.env creds)
#
# Locking: not configured. Single-operator workflow; if a second person ever
# runs terraform we'll add S3 native lockfile or a DynamoDB lock table.
