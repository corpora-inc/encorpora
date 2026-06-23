# ---------------------------------------------------------------------------
# IAP observability — Stage 3
#
# The verify lambda + notification handlers are intentionally best-effort: they
# catch errors and return 2xx so a bad payload can't turn a real purchase into a
# failure. The downside is failures are SILENT (the Android verify bug went
# unnoticed for days). This wires a metric filter on the explicit error markers
# the code emits + an alarm -> SNS email, so the next regression pages us in
# minutes instead of being found by accident.
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "iap_alerts" {
  name = "${var.project_name}-iap-alerts"
}

# Confirm via the email Amazon sends after apply.
resource "aws_sns_topic_subscription" "iap_alerts_email" {
  topic_arn = aws_sns_topic.iap_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Count the handler's explicit error markers (NOT plain "ERROR" — that matches
# the noisy Node SDK version warning).
resource "aws_cloudwatch_log_metric_filter" "verify_errors" {
  name           = "${var.project_name}-verify-errors"
  log_group_name = "/aws/lambda/${local.verify_lambda_name}"
  pattern        = "?\"] handler error\" ?\"signature verify failed\" ?\"[verify] FAILED\" ?\"OIDC validation failed\" ?\"attributeFromOffer failed\" ?\"attributePurchase failed\""

  metric_transformation {
    name          = "VerifyHandlerErrors"
    namespace     = "Corpan/IAP"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "verify_errors" {
  alarm_name          = "${var.project_name}-verify-handler-errors"
  alarm_description   = "verify-purchase / store-notification handler emitted error log(s) — investigate CloudWatch /aws/lambda/${local.verify_lambda_name}"
  namespace           = "Corpan/IAP"
  metric_name         = "VerifyHandlerErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.iap_alerts.arn]
  ok_actions          = [aws_sns_topic.iap_alerts.arn]
}

# Also alarm on hard Lambda faults (timeouts / unhandled exceptions).
resource "aws_cloudwatch_metric_alarm" "verify_lambda_faults" {
  alarm_name          = "${var.project_name}-verify-lambda-faults"
  alarm_description   = "verify lambda hard errors (timeouts/unhandled) — ${local.verify_lambda_name}"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = local.verify_lambda_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.iap_alerts.arn]
}
