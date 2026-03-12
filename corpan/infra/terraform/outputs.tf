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

output "cdn_domain" {
  value = var.enable_cdn ? (
    var.cdn_domain_name != "" ? var.cdn_domain_name : aws_cloudfront_distribution.packs[0].domain_name
  ) : ""
  description = "CloudFront distribution domain (custom or default *.cloudfront.net)."
}

output "cdn_distribution_id" {
  value       = var.enable_cdn ? aws_cloudfront_distribution.packs[0].id : ""
  description = "CloudFront distribution ID (for cache invalidation)."
}

output "dgx_publisher_user" {
  value       = aws_iam_user.dgx_publisher.name
  description = "IAM user name for DGX publisher uploads."
}

output "cdn_certificate_validation" {
  value = var.enable_cdn && var.cdn_domain_name != "" ? aws_acm_certificate.cdn[0].domain_validation_options : []
  description = "DNS validation records for CDN ACM certificate."
}
