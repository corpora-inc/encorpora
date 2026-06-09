# ---------------------------------------------------------------------------
# Affiliate + discount codes (0.17.4) — DynamoDB single-table `corpan-iap`
# ---------------------------------------------------------------------------
#
# Single-table design (AFFILIATE_CODES_PLAN.md §3.2). PK/SK composite, on-demand
# billing, PITR on, TTL attribute for transient items. Item types:
#   CODE#<code>/META, SUBJECT#<id>/{ATTRIBUTION,PURCHASE#...},
#   LEDGER#<partner>#<yyyy-mm>/EVENT#..., PARTNER#<id>/META, TOKEN#<plat>#<key>/SUBJECT
#
# The HMAC secret that signs resolutionToken + entitlementToken is generated
# here and stored in the existing verify secret JSON (key `tokenSigningSecret`),
# so the Lambda reads it from Secrets Manager alongside the Apple/Google creds.
# (The plan allows KMS Sign/Verify OR a secret-derived HMAC; HMAC keeps the hot
# path local — no per-request KMS round-trip — and is what the code implements.)

resource "aws_dynamodb_table" "iap" {
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

  point_in_time_recovery {
    enabled = true
  }

  # Transient items (e.g. rate-limit / token-map rows) may set `ttl`.
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Project = var.project_name
    Purpose = "iap-affiliate-codes"
  }
}

# HMAC signing secret for resolutionToken + entitlementToken. Generated once and
# kept in Terraform state; rotate by tainting this resource (invalidates all
# outstanding short-lived tokens — acceptable, they expire in minutes/24h).
#
# NOTE: we deliberately do NOT add this to the existing
# `corpan/content-packs/verify` secret — that secret's Apple/Google credentials
# are populated OUT OF BAND (the committed jsonencode has empty strings), so a
# terraform-managed write of that secret would clobber the live prod creds. We
# use a SEPARATE secret here and the Lambda reads both.
resource "random_password" "iap_token_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "iap_token" {
  name = "${var.project_name}/iap/token-signing"
}

resource "aws_secretsmanager_secret_version" "iap_token" {
  secret_id     = aws_secretsmanager_secret.iap_token.id
  secret_string = jsonencode({ tokenSigningSecret = random_password.iap_token_secret.result })
}
