# ---------------------------------------------------------------------------
# Anonymous reader analytics pipeline
#
#   Reader → CloudFront → Lambda Function URL → Firehose → S3 (Parquet) → Athena
#
# Privacy contract — locked in by infra:
#   - No identifiers persisted in queryable storage. The Glue table has NO
#     ip / user_agent / x_forwarded_for columns. The ingest Lambda strips
#     anything not in its allowlist before writing.
#   - CloudFront-Viewer-Country is the only geo header forwarded to origin.
#     The IP arrives at the Lambda but is never written. Subdivision-level
#     geo (Country-Region) is intentionally not forwarded.
#   - CloudWatch retention 7d (cheap) and only counts/errors are logged —
#     never request bodies.
#   - Athena workgroup encrypts query results and writes them to a separate
#     S3 prefix with its own lifecycle.
# ---------------------------------------------------------------------------

locals {
  analytics_lambda_name   = "${var.project_name}-analytics-ingest"
  analytics_bucket_name   = "${var.project_name}-analytics-prod"
  analytics_glue_database = "${var.project_name}_analytics"
  analytics_glue_table    = "events"
  analytics_firehose_name = "${var.project_name}-analytics-events"
  analytics_workgroup     = "${var.project_name}-analytics"
}

# ---------------------------------------------------------------------------
# S3 — analytics data lake (events + Athena query results)
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "analytics" {
  bucket = local.analytics_bucket_name
}

resource "aws_s3_bucket_public_access_block" "analytics" {
  bucket                  = aws_s3_bucket.analytics.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "analytics" {
  bucket = aws_s3_bucket.analytics.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "analytics" {
  bucket = aws_s3_bucket.analytics.id

  # Cold events → Glacier Deep Archive after 90d. Reader analytics queries
  # almost always look at "now" or "last N days"; year-old data is for
  # rare ad-hoc analyses where 12h restore latency is fine.
  rule {
    id     = "events-cold-to-glacier"
    status = "Enabled"
    filter { prefix = "events/" }
    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }
    expiration {
      days = 730
    }
  }

  # Athena query results — short-lived, expire weekly to control bucket size
  rule {
    id     = "athena-results-expire"
    status = "Enabled"
    filter { prefix = "athena-results/" }
    expiration {
      days = 7
    }
  }
}

# ---------------------------------------------------------------------------
# Glue Data Catalog — schema for Athena
# ---------------------------------------------------------------------------

resource "aws_glue_catalog_database" "analytics" {
  name = local.analytics_glue_database
}

resource "aws_glue_catalog_table" "events" {
  name          = local.analytics_glue_table
  database_name = aws_glue_catalog_database.analytics.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "classification"          = "parquet"
    "parquet.compression"     = "SNAPPY"
    "projection.enabled"      = "true"
    "projection.dt.type"      = "date"
    "projection.dt.format"    = "yyyy-MM-dd"
    "projection.dt.range"     = "2026-04-01,NOW"
    "projection.dt.interval"  = "1"
    "projection.dt.interval.unit" = "DAYS"
    "projection.hour.type"    = "integer"
    "projection.hour.range"   = "0,23"
    "projection.hour.digits"  = "2"
    "storage.location.template" = "s3://${aws_s3_bucket.analytics.bucket}/events/dt=$${dt}/hour=$${hour}/"
  }

  partition_keys {
    name = "dt"
    type = "string"
  }
  partition_keys {
    name = "hour"
    type = "string"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.analytics.bucket}/events/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      name                  = "parquet-serde"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }

    columns {
      name = "schema"
      type = "int"
    }
    columns {
      name = "ts"
      type = "string"
    }
    columns {
      name = "session_id"
      type = "string"
    }
    columns {
      name = "event"
      type = "string"
    }
    columns {
      name = "reader_id"
      type = "string"
    }
    columns {
      name = "reader_version"
      type = "string"
    }
    columns {
      name = "app_version"
      type = "string"
    }
    columns {
      name = "platform"
      type = "string"
    }
    columns {
      name = "locale"
      type = "string"
    }
    columns {
      name = "tz_offset_minutes"
      type = "int"
    }
    columns {
      name = "book_id"
      type = "string"
    }
    columns {
      name = "narration_pack_id"
      type = "string"
    }
    columns {
      name = "language"
      type = "string"
    }
    columns {
      name = "voice_id"
      type = "string"
    }
    columns {
      name = "duration_ms"
      type = "int"
    }
    columns {
      name = "country"
      type = "string"
    }
    columns {
      name = "ingest_ts"
      type = "string"
    }
    # Forward-compat: arbitrary client `props` (any JSON) land here as a string.
    # Athena queries pull individual fields with json_extract(props_json, '$.x').
    # Lets us add new event types client-side without a Glue/Lambda redeploy.
    columns {
      name = "props_json"
      type = "string"
    }
  }
}

# ---------------------------------------------------------------------------
# Firehose — JSON → Parquet, partitioned dt=/hour=
# ---------------------------------------------------------------------------

resource "aws_iam_role" "firehose" {
  name = "${var.project_name}-analytics-firehose"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "firehose.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "firehose" {
  name = "${var.project_name}-analytics-firehose-policy"
  role = aws_iam_role.firehose.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject",
        ]
        Resource = [
          aws_s3_bucket.analytics.arn,
          "${aws_s3_bucket.analytics.arn}/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "glue:GetTable",
          "glue:GetTableVersion",
          "glue:GetTableVersions",
        ]
        Resource = [
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:catalog",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:database/${aws_glue_catalog_database.analytics.name}",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${aws_glue_catalog_database.analytics.name}/${aws_glue_catalog_table.events.name}",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "*"
      },
    ]
  })
}

data "aws_caller_identity" "current" {}

resource "aws_cloudwatch_log_group" "firehose" {
  name              = "/aws/kinesisfirehose/${local.analytics_firehose_name}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_stream" "firehose_s3" {
  name           = "S3Delivery"
  log_group_name = aws_cloudwatch_log_group.firehose.name
}

resource "aws_kinesis_firehose_delivery_stream" "events" {
  name        = local.analytics_firehose_name
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose.arn
    bucket_arn = aws_s3_bucket.analytics.arn

    # Dynamic partitioning by ingest time → cheap Athena scans for time-bounded queries
    prefix              = "events/dt=!{timestamp:yyyy-MM-dd}/hour=!{timestamp:HH}/"
    error_output_prefix = "errors/dt=!{timestamp:yyyy-MM-dd}/!{firehose:error-output-type}/"

    buffering_size     = 64
    buffering_interval = 60

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose.name
      log_stream_name = aws_cloudwatch_log_stream.firehose_s3.name
    }

    data_format_conversion_configuration {
      input_format_configuration {
        deserializer {
          open_x_json_ser_de {}
        }
      }
      output_format_configuration {
        serializer {
          parquet_ser_de {
            compression = "SNAPPY"
          }
        }
      }
      schema_configuration {
        database_name = aws_glue_catalog_database.analytics.name
        table_name    = aws_glue_catalog_table.events.name
        role_arn      = aws_iam_role.firehose.arn
        region        = var.aws_region
      }
    }
  }
}

# ---------------------------------------------------------------------------
# Lambda — analytics ingest (Function URL, no API Gateway)
# ---------------------------------------------------------------------------

resource "aws_iam_role" "analytics_lambda" {
  name = "${var.project_name}-analytics-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "analytics_lambda" {
  name = "${var.project_name}-analytics-lambda-policy"
  role = aws_iam_role.analytics_lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["firehose:PutRecord", "firehose:PutRecordBatch"]
        Resource = aws_kinesis_firehose_delivery_stream.events.arn
      },
    ]
  })
}

data "archive_file" "analytics_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda-analytics"
  output_path = "${path.module}/build/analytics_ingest.zip"
}

resource "aws_lambda_function" "analytics_ingest" {
  function_name    = local.analytics_lambda_name
  role             = aws_iam_role.analytics_lambda.arn
  handler          = "analytics_ingest.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.analytics_zip.output_path
  source_code_hash = data.archive_file.analytics_zip.output_base64sha256
  timeout          = 5
  memory_size      = 128
  environment {
    variables = {
      FIREHOSE_NAME = aws_kinesis_firehose_delivery_stream.events.name
    }
  }
}

resource "aws_cloudwatch_log_group" "analytics_lambda" {
  name              = "/aws/lambda/${local.analytics_lambda_name}"
  retention_in_days = 7
}

# API Gateway HTTP API → Lambda. Mirrors the pattern used by the existing
# corpan-verify HTTP API, which has been battle-tested in this account.
# Function URLs returned a stubborn AccessDeniedException at the URL layer
# even with a fully-permissive resource policy in place; rather than fight
# that opaque failure mode, we use API Gateway which is known to work.

resource "aws_apigatewayv2_api" "analytics" {
  name          = "${var.project_name}-analytics"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "analytics" {
  api_id                 = aws_apigatewayv2_api.analytics.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.analytics_ingest.invoke_arn
  payload_format_version = "2.0"
}

# A single catch-all route — Lambda inspects routeKey/path itself, but we
# don't actually care: every payload goes to the same handler.
resource "aws_apigatewayv2_route" "analytics_default" {
  api_id    = aws_apigatewayv2_api.analytics.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.analytics.id}"
}

resource "aws_apigatewayv2_stage" "analytics" {
  api_id      = aws_apigatewayv2_api.analytics.id
  name        = "prod"
  auto_deploy = true
}

resource "aws_lambda_permission" "analytics_apigw" {
  statement_id  = "AllowInvokeAnalytics"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_ingest.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.analytics.execution_arn}/*/*"
}

# ---------------------------------------------------------------------------
# CloudFront in front of API Gateway — adds CloudFront-Viewer-Country header
# (free geo enrichment) and absorbs bursts. No caching (POST-only).
# ---------------------------------------------------------------------------

# Pull the host portion out of the API Gateway invoke URL.
locals {
  analytics_origin_host = replace(replace(aws_apigatewayv2_stage.analytics.invoke_url, "https://", ""), "/${aws_apigatewayv2_stage.analytics.name}", "")
}

resource "aws_cloudfront_origin_request_policy" "analytics" {
  name    = "${var.project_name}-analytics-orp"
  comment = "Forward CloudFront geo headers + content-type to the analytics Lambda"

  cookies_config {
    cookie_behavior = "none"
  }

  query_strings_config {
    query_string_behavior = "none"
  }

  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        # Server-enriched geo (country only — subdivision intentionally NOT forwarded
        # to keep us aligned with the "very crude geo" privacy line).
        "CloudFront-Viewer-Country",
        "Content-Type",
        # CORS — without these, WebKit's preflight from a Tauri WKWebView
        # (custom URI scheme → Origin: null) can't be satisfied by the Lambda's
        # echo-Origin pattern, because CloudFront strips Origin before origin sees it.
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
      ]
    }
  }
}

# Disable caching for POSTs — there's no "managed CachingDisabled" we can
# reference safely without hardcoding IDs, so define our own.
resource "aws_cloudfront_cache_policy" "analytics_no_cache" {
  name        = "${var.project_name}-analytics-no-cache"
  comment     = "No caching for analytics POSTs"
  default_ttl = 0
  min_ttl     = 0
  max_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = false
    enable_accept_encoding_gzip   = false
    cookies_config {
      cookie_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
  }
}

resource "aws_cloudfront_distribution" "analytics" {
  enabled = true
  comment = "${var.project_name} anonymous analytics ingest"

  price_class = "PriceClass_100"

  origin {
    domain_name = local.analytics_origin_host
    origin_id   = "apigw-analytics"
    origin_path = "/${aws_apigatewayv2_stage.analytics.name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "apigw-analytics"
    viewer_protocol_policy = "https-only"
    compress               = true

    cache_policy_id          = aws_cloudfront_cache_policy.analytics_no_cache.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.analytics.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# ---------------------------------------------------------------------------
# Athena — workgroup with query results written to its own S3 prefix
# ---------------------------------------------------------------------------

resource "aws_athena_workgroup" "analytics" {
  name = local.analytics_workgroup

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${aws_s3_bucket.analytics.bucket}/athena-results/"
      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }
  }

  force_destroy = true
}

# ---------------------------------------------------------------------------
# IAM user — read-only analytics access for the agent on the DGX Spark
# ---------------------------------------------------------------------------

resource "aws_iam_user" "analyst" {
  name = "${var.project_name}-analyst"
}

resource "aws_iam_user_policy" "analyst" {
  name = "${var.project_name}-analyst-policy"
  user = aws_iam_user.analyst.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "athena:StartQueryExecution",
          "athena:GetQueryExecution",
          "athena:GetQueryResults",
          "athena:StopQueryExecution",
          "athena:GetWorkGroup",
          "athena:ListQueryExecutions",
        ]
        Resource = aws_athena_workgroup.analytics.arn
      },
      {
        Effect = "Allow"
        Action = [
          "glue:GetDatabase",
          "glue:GetTable",
          "glue:GetTables",
          "glue:GetPartition",
          "glue:GetPartitions",
        ]
        Resource = [
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:catalog",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:database/${aws_glue_catalog_database.analytics.name}",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${aws_glue_catalog_database.analytics.name}/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetBucketLocation",
          "s3:ListBucket",
        ]
        Resource = aws_s3_bucket.analytics.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
        ]
        Resource = [
          "${aws_s3_bucket.analytics.arn}/events/*",
          "${aws_s3_bucket.analytics.arn}/athena-results/*",
        ]
      },
    ]
  })
}
