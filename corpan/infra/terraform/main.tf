locals {
  verify_lambda_name = "${var.project_name}-verify-purchase"
  secrets_name       = "${var.project_name}/content-packs/verify"
}

resource "aws_s3_bucket" "packs" {
  bucket = var.pack_bucket_name
}

resource "aws_s3_bucket_public_access_block" "packs" {
  bucket                  = aws_s3_bucket.packs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "packs" {
  bucket = aws_s3_bucket.packs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "packs" {
  bucket = aws_s3_bucket.packs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_secretsmanager_secret" "verify" {
  name = local.secrets_name
}

resource "aws_secretsmanager_secret_version" "verify" {
  secret_id = aws_secretsmanager_secret.verify.id
  secret_string = jsonencode({
    apple = {
      key_id     = "",
      issuer_id  = "",
      privateKey = "",
      bundleId   = "com.corpora.corpan"
    },
    google = {
      packageName        = "com.corpora.corpan",
      serviceAccountJson = ""
    },
    cloudfront = {
      signingPrivateKey = ""
    },
    # codeSigning.hmacKey signs/validates the resolutionToken + entitlementToken
    # (Phase 3 codes backend, JWT HS256). This is a DOCUMENTATION placeholder —
    # the REAL key is set OUT OF BAND by the integrator (like appStoreConnect),
    # and `lifecycle.ignore_changes` below ensures `terraform apply` NEVER
    # overwrites the live value with this empty placeholder.
    codeSigning = {
      hmacKey = "",
      kid     = "v1"
    }
  })

  # CRITICAL: the live secret holds REAL values (google/apple/cloudfront/
  # appStoreConnect/codeSigning.hmacKey) set OUT OF BAND. Terraform must NOT
  # manage secret_string drift, or an apply would reset every live value to the
  # empty placeholders above and break the live verify lambda + codes backend.
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ---------------------------------------------------------------------------
# DynamoDB single-table store for the IAP / affiliate-codes backend (Phase 3).
# Single-table design (see PHASE3_CODES_CONTRACT.md §7): code registry,
# attribution locks, purchase idempotency rows, ledger events, partner rows.
# GSI1 reverse-maps a Google obfuscatedExternalAccountId (= sha256Hex(subjectId))
# back to the locked subject without reversing the hash (contract §7.3).
# ---------------------------------------------------------------------------

resource "aws_dynamodb_table" "corpan_iap" {
  name         = "${var.project_name}-iap"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  # GSI1: Google renewal reverse-map. GSI1PK = obfHash, GSI1SK = SK.
  # SK is already a top-level table attribute, so it is reused as GSI1SK.
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "SK"
    projection_type = "INCLUDE"
    non_key_attributes = [
      "partnerId",
      "subjectId",
      "status"
    ]
  }

  point_in_time_recovery {
    enabled = true
  }
}

resource "aws_iam_role" "verify_lambda" {
  name = "${var.project_name}-verify-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "verify_lambda" {
  name = "${var.project_name}-verify-lambda-policy"
  role = aws_iam_role.verify_lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.verify.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.corpan_iap.arn,
          "${aws_dynamodb_table.corpan_iap.arn}/index/GSI1"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.packs.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.packs.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["artifacts/narrations/premium/*"]
          }
        }
      }
    ]
  })
}

data "archive_file" "verify_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/build/verify_purchase.zip"
}

resource "aws_lambda_function" "verify" {
  function_name    = local.verify_lambda_name
  role             = aws_iam_role.verify_lambda.arn
  handler          = "verify_purchase.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.verify_zip.output_path
  source_code_hash = data.archive_file.verify_zip.output_base64sha256
  timeout          = 10
  memory_size      = 256
  environment {
    variables = {
      PACK_BUCKET            = aws_s3_bucket.packs.bucket
      SECRETS_ARN            = aws_secretsmanager_secret.verify.arn
      DYNAMO_TABLE           = aws_dynamodb_table.corpan_iap.name
      DEV_BYPASS_TOKEN       = var.dev_bypass_token
      CLOUDFRONT_DOMAIN      = var.enable_cdn ? (var.cdn_domain_name != "" ? var.cdn_domain_name : aws_cloudfront_distribution.packs[0].domain_name) : ""
      CLOUDFRONT_KEY_PAIR_ID = var.enable_cdn && var.enable_premium_content ? aws_cloudfront_public_key.premium[0].id : ""
      CATALOG_URL            = var.enable_cdn ? "https://${var.cdn_domain_name != "" ? var.cdn_domain_name : aws_cloudfront_distribution.packs[0].domain_name}/catalog.json" : ""
    }
  }
}

resource "aws_apigatewayv2_api" "verify" {
  name          = "${var.project_name}-verify"
  protocol_type = "HTTP"

  # CORS — needed because the reader pack runs in a corpan-pack:// origin
  # WebView and the main app runs in a tauri:// (or http://localhost) origin.
  # Without this, the browser sends an OPTIONS preflight, the gateway returns
  # 404 (no matching route), and the actual POST never fires — failing with
  # the unhelpful "Load failed" error in WKWebView.
  #
  # `*` is fine here: auth is enforced by the platform receipt the Lambda
  # validates, not by Origin (anyone can curl this endpoint already).
  # NOTE: API Gateway v2's `*` wildcard does NOT match `Origin: null` —
  # tested with curl, the gateway omits CORS headers entirely for null
  # origins. WKWebView sends `Origin: null` for fetches from custom URI
  # schemes (`corpan-pack://`), so we have to enumerate every origin we
  # actually use. The endpoint is still safe — auth is by platform receipt.
  # CORS is handled entirely by the Lambda (verify_purchase.js lines 10-18).
  # Every response includes access-control-allow-origin: * which browsers
  # match against ALL origins including Origin: null.
  #
  # DO NOT use cors_configuration here. API Gateway v2's cors_configuration
  # intercepts OPTIONS and applies its own origin matching, but its "*"
  # does NOT match "null" (the origin WKWebView sends for custom URI
  # schemes like corpan-pack://). The result: preflight 204 with no CORS
  # headers → browser blocks the response. The Lambda's "*" works because
  # browsers follow the Fetch spec where "*" means "any origin".
  #
  # Instead, a $default catch-all route forwards OPTIONS to the Lambda,
  # which returns 204 with proper CORS headers. See aws_apigatewayv2_route.default.
}

resource "aws_apigatewayv2_integration" "verify" {
  api_id                 = aws_apigatewayv2_api.verify.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.verify.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "verify" {
  api_id    = aws_apigatewayv2_api.verify.id
  route_key = "POST /verify-purchase"
  target    = "integrations/${aws_apigatewayv2_integration.verify.id}"
}

resource "aws_apigatewayv2_route" "subscription_status" {
  api_id    = aws_apigatewayv2_api.verify.id
  route_key = "POST /subscription-status"
  target    = "integrations/${aws_apigatewayv2_integration.verify.id}"
}

resource "aws_apigatewayv2_route" "apple_notifications" {
  api_id    = aws_apigatewayv2_api.verify.id
  route_key = "POST /apple-notifications"
  target    = "integrations/${aws_apigatewayv2_integration.verify.id}"
}

resource "aws_apigatewayv2_route" "google_notifications" {
  api_id    = aws_apigatewayv2_api.verify.id
  route_key = "POST /google-notifications"
  target    = "integrations/${aws_apigatewayv2_integration.verify.id}"
}

# Phase 3 codes backend — both routed to the SAME existing verify lambda,
# which dispatches by event.routeKey (no new lambda; contract §2, §4).
resource "aws_apigatewayv2_route" "code_resolve" {
  api_id    = aws_apigatewayv2_api.verify.id
  route_key = "POST /code/resolve"
  target    = "integrations/${aws_apigatewayv2_integration.verify.id}"
}

resource "aws_apigatewayv2_route" "entitlement_token" {
  api_id    = aws_apigatewayv2_api.verify.id
  route_key = "POST /entitlement-token"
  target    = "integrations/${aws_apigatewayv2_integration.verify.id}"
}

# Catch-all route: forwards OPTIONS (and any other unmatched method/path)
# to the Lambda. Required because cors_configuration is NOT used — the
# Lambda handles CORS itself with access-control-allow-origin: * which
# correctly matches Origin: null from WKWebView custom URI schemes.
resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.verify.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.verify.id}"
}

resource "aws_apigatewayv2_stage" "verify" {
  api_id      = aws_apigatewayv2_api.verify.id
  name        = "prod"
  auto_deploy = true
}

resource "aws_lambda_permission" "verify" {
  statement_id  = "AllowInvokeVerify"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.verify.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.verify.execution_arn}/*/*"
}

resource "aws_acm_certificate" "verify" {
  count             = var.enable_custom_domain ? 1 : 0
  domain_name       = var.custom_domain_name
  validation_method = "DNS"
}

resource "aws_apigatewayv2_domain_name" "verify" {
  count       = var.enable_custom_domain ? 1 : 0
  domain_name = var.custom_domain_name
  domain_name_configuration {
    certificate_arn = aws_acm_certificate.verify[0].arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "verify" {
  count       = var.enable_custom_domain ? 1 : 0
  api_id      = aws_apigatewayv2_api.verify.id
  domain_name = aws_apigatewayv2_domain_name.verify[0].domain_name
  stage       = aws_apigatewayv2_stage.verify.name
}

# ---------------------------------------------------------------------------
# CloudFront CDN for narration artifacts
# ---------------------------------------------------------------------------

resource "aws_cloudfront_origin_access_control" "packs" {
  count                             = var.enable_cdn ? 1 : 0
  name                              = "${var.project_name}-packs-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "cdn" {
  count             = var.enable_cdn && var.cdn_domain_name != "" ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.cdn_domain_name
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_cloudfront_response_headers_policy" "cors" {
  count   = var.enable_cdn ? 1 : 0
  name    = "${var.project_name}-cors-policy"
  comment = "CORS headers for browser-based catalog/narration access"

  cors_config {
    access_control_allow_origins {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD"]
    }
    access_control_allow_headers {
      items = ["*"]
    }
    access_control_allow_credentials = false
    access_control_max_age_sec       = 86400
    origin_override                  = true
  }
}

resource "aws_cloudfront_distribution" "packs" {
  count   = var.enable_cdn ? 1 : 0
  enabled = true
  comment = "${var.project_name} narration artifact CDN"

  default_root_object = "catalog.json"
  price_class         = "PriceClass_100"

  aliases = var.cdn_domain_name != "" ? [var.cdn_domain_name] : []

  origin {
    domain_name              = aws_s3_bucket.packs.bucket_regional_domain_name
    origin_id                = "s3-packs"
    origin_path              = "/artifacts"
    origin_access_control_id = aws_cloudfront_origin_access_control.packs[0].id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-packs"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors[0].id
  }

  # Premium content requires CloudFront signed URLs
  dynamic "ordered_cache_behavior" {
    for_each = var.enable_premium_content ? [1] : []
    content {
      path_pattern           = "narrations/premium/*"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      target_origin_id       = "s3-packs"
      viewer_protocol_policy = "redirect-to-https"
      compress               = true
      trusted_key_groups     = [aws_cloudfront_key_group.premium[0].id]

      cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
      response_headers_policy_id = aws_cloudfront_response_headers_policy.cors[0].id
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.cdn_domain_name != "" ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate.cdn[0].arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.cdn_domain_name == "" ? [1] : []
    content {
      cloudfront_default_certificate = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

resource "aws_s3_bucket_policy" "cloudfront_access" {
  count  = var.enable_cdn ? 1 : 0
  bucket = aws_s3_bucket.packs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.packs.arn}/artifacts/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.packs[0].arn
          }
        }
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# CloudFront signed URLs for premium/paid content
# ---------------------------------------------------------------------------

resource "aws_cloudfront_public_key" "premium" {
  count       = var.enable_cdn && var.enable_premium_content ? 1 : 0
  name        = "${var.project_name}-premium-signing-key"
  encoded_key = var.cloudfront_signing_public_key_pem
  comment     = "Public key for signing premium content download URLs"
}

resource "aws_cloudfront_key_group" "premium" {
  count   = var.enable_cdn && var.enable_premium_content ? 1 : 0
  name    = "${var.project_name}-premium-key-group"
  items   = [aws_cloudfront_public_key.premium[0].id]
  comment = "Key group for premium narration pack downloads"
}

# ---------------------------------------------------------------------------
# IAM user for DGX publisher (uploads from Spark to S3)
# ---------------------------------------------------------------------------

resource "aws_iam_user" "dgx_publisher" {
  name = "${var.project_name}-dgx-publisher"
}

resource "aws_iam_user_policy" "dgx_publisher" {
  name = "${var.project_name}-dgx-publisher-policy"
  user = aws_iam_user.dgx_publisher.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = [
          "${aws_s3_bucket.packs.arn}/staging/*",
          "${aws_s3_bucket.packs.arn}/artifacts/*",
          "${aws_s3_bucket.packs.arn}/sources/*",
          "${aws_s3_bucket.packs.arn}/pack-store/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.packs.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["staging/*", "artifacts/*", "sources/*", "pack-store/*"]
          }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = var.enable_cdn ? aws_cloudfront_distribution.packs[0].arn : "*"
      }
    ]
  })
}
