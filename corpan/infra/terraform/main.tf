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
  secret_id     = aws_secretsmanager_secret.verify.id
  secret_string = jsonencode({
    apple = {
      key_id     = "",
      issuer_id  = "",
      privateKey = ""
    },
    google = {
      serviceAccountJson = ""
    }
  })
}

resource "aws_iam_role" "verify_lambda" {
  name = "${var.project_name}-verify-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action = "sts:AssumeRole"
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
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.verify.arn
      },
      {
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.packs.arn}/*"
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
  function_name = local.verify_lambda_name
  role          = aws_iam_role.verify_lambda.arn
  handler       = "verify_purchase.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.verify_zip.output_path
  timeout       = 10
  memory_size   = 256
  environment {
    variables = {
      PACK_BUCKET        = aws_s3_bucket.packs.bucket
      SECRETS_ARN        = aws_secretsmanager_secret.verify.arn
      PACK_MANIFEST_URL  = var.pack_manifest_url
      PACK_MANIFEST_HASH = var.pack_manifest_hash
      PACK_VERSION       = var.pack_version
      DEV_BYPASS_TOKEN   = var.dev_bypass_token
    }
  }
}

resource "aws_apigatewayv2_api" "verify" {
  name          = "${var.project_name}-verify"
  protocol_type = "HTTP"
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
  count = var.enable_custom_domain ? 1 : 0
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
