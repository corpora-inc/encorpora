# Explicit trust for outbound HTTPS in managed runtimes. See tls-trust/README.md.
data "archive_file" "tls_trust" {
  type        = "zip"
  source_dir  = "${path.module}/tls-trust"
  output_path = "${path.module}/build/tls_trust.zip"
}

resource "aws_lambda_layer_version" "tls_trust" {
  layer_name          = "${var.project_name}-tls-trust"
  description         = "Mozilla CA bundle 2026-10-20 with eMudhra distrust"
  filename            = data.archive_file.tls_trust.output_path
  source_code_hash    = data.archive_file.tls_trust.output_base64sha256
  compatible_runtimes = ["nodejs22.x"]
}
