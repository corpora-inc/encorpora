variable "aws_region" {
  type        = string
  description = "AWS region for all resources."
  default     = "us-east-2"
}

variable "project_name" {
  type        = string
  description = "Prefix for resource names."
  default     = "corpan"
}

variable "pack_bucket_name" {
  type        = string
  description = "S3 bucket for pack artifacts."
  default     = "corpan-prod"
}

variable "enable_custom_domain" {
  type        = bool
  description = "Whether to provision API Gateway custom domain + ACM cert."
  default     = false
}

variable "custom_domain_name" {
  type        = string
  description = "Custom domain for verify endpoint (regional)."
  default     = "verify.encorpora.io"
}

variable "catalog_domain_name" {
  type        = string
  description = "Optional catalog domain (for future use)."
  default     = "catalog.encorpora.io"
}

variable "pack_manifest_url" {
  type        = string
  description = "Manifest URL returned by verify endpoint (dev bypass)."
  default     = ""
}

variable "pack_manifest_hash" {
  type        = string
  description = "Manifest hash returned by verify endpoint (dev bypass)."
  default     = ""
}

variable "pack_version" {
  type        = string
  description = "Pack version returned by verify endpoint (dev bypass)."
  default     = ""
}

variable "dev_bypass_token" {
  type        = string
  description = "Header token to enable dev bypass on verify endpoint."
  default     = ""
}
