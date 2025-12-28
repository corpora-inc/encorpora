output "verify_api_url" {
  value       = aws_apigatewayv2_stage.verify.invoke_url
  description = "Base URL for verify API (append /verify-purchase)."
}

output "verify_custom_domain_validation" {
  value = var.enable_custom_domain ? aws_acm_certificate.verify[0].domain_validation_options : []
  description = "DNS validation records for custom domain (Namecheap)."
}

output "pack_bucket" {
  value       = aws_s3_bucket.packs.bucket
  description = "S3 bucket for pack artifacts."
}
