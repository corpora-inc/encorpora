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

output "premium_key_group_id" {
  value       = var.enable_cdn && var.enable_premium_content ? aws_cloudfront_key_group.premium[0].id : ""
  description = "CloudFront key group ID for premium content signed URLs."
}

output "premium_public_key_id" {
  value       = var.enable_cdn && var.enable_premium_content ? aws_cloudfront_public_key.premium[0].id : ""
  description = "CloudFront public key ID used in signed URL generation."
}

output "analytics_endpoint" {
  value       = "https://${aws_cloudfront_distribution.analytics.domain_name}/v1/events"
  description = "Analytics POST endpoint (CloudFront → Lambda Function URL)."
}

output "analytics_apigw_url" {
  value       = aws_apigatewayv2_stage.analytics.invoke_url
  description = "Direct API Gateway URL (origin behind CloudFront)."
}

output "analytics_bucket" {
  value       = aws_s3_bucket.analytics.bucket
  description = "S3 bucket holding analytics events and Athena query results."
}

output "analytics_workgroup" {
  value       = aws_athena_workgroup.analytics.name
  description = "Athena workgroup for analytics queries."
}

output "analytics_database" {
  value       = aws_glue_catalog_database.analytics.name
  description = "Glue database containing the analytics events table."
}

output "analyst_user" {
  value       = aws_iam_user.analyst.name
  description = "IAM user for read-only analytics queries from the DGX agent."
}
