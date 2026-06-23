# ---------------------------------------------------------------------------
# Google Play Real-time Developer Notifications (RTDN) delivery — Stage 3
#
# The Pub/Sub topic `play-billing-notifications` already exists in GCP project
# corpora1 and already grants Google Play's publisher service account
# roles/pubsub.publisher (so Play Console is pointed at it). What was missing is
# a SUBSCRIPTION delivering those messages to our verify lambda — so RTDN events
# (renewals, cancels, refunds, …) went nowhere. This adds an AUTHENTICATED push
# subscription to POST /google-notifications, with an OIDC identity the handler
# verifies (fail-closed). The topic itself is left as-is (not managed here).
#
# Credentials: GOOGLE_APPLICATION_CREDENTIALS=/home/skyl/secrets/gcp.json
# (admin-account@corpora1) + GOOGLE_CLOUD_PROJECT=corpora1.
# ---------------------------------------------------------------------------

provider "google" {
  project = "corpora1"
  # Application Default Credentials via GOOGLE_APPLICATION_CREDENTIALS.
}

data "google_project" "corpora" {
  project_id = "corpora1"
}

# APIs required to manage the push identity + subscription.
resource "google_project_service" "iam" {
  project            = "corpora1"
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "pubsub" {
  project            = "corpora1"
  service            = "pubsub.googleapis.com"
  disable_on_destroy = false
}

locals {
  rtdn_topic       = "projects/corpora1/topics/play-billing-notifications"
  google_notif_url = "${aws_apigatewayv2_stage.verify.invoke_url}/google-notifications"
  # Pub/Sub's service agent — mints the OIDC token for authenticated push.
  pubsub_agent = "serviceAccount:service-${data.google_project.corpora.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Identity whose signed OIDC token rides on each push request; our handler
# checks `email` + `aud` against this (google.pubsubServiceAccount / pubsubAudience).
resource "google_service_account" "rtdn_push" {
  project      = "corpora1"
  account_id   = "rtdn-push-invoker"
  display_name = "Play RTDN push OIDC identity -> Corpan verify lambda"
  depends_on   = [google_project_service.iam]
}

# Allow Pub/Sub to mint OIDC tokens as the push identity.
resource "google_service_account_iam_member" "rtdn_token_creator" {
  service_account_id = google_service_account.rtdn_push.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.pubsub_agent
}

# Authenticated push subscription -> our public verify endpoint.
resource "google_pubsub_subscription" "rtdn_push" {
  project = "corpora1"
  name    = "play-rtdn-to-corpan-verify"
  topic   = local.rtdn_topic

  ack_deadline_seconds       = 30
  message_retention_duration = "604800s" # 7d — redelivery window if we're down

  expiration_policy {
    ttl = "" # never expire
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  push_config {
    push_endpoint = local.google_notif_url
    oidc_token {
      service_account_email = google_service_account.rtdn_push.email
      audience              = local.google_notif_url
    }
  }

  depends_on = [google_service_account_iam_member.rtdn_token_creator]
}

output "rtdn_push_service_account" {
  description = "Put in secret google.pubsubServiceAccount"
  value       = google_service_account.rtdn_push.email
}

output "rtdn_push_audience" {
  description = "Put in secret google.pubsubAudience"
  value       = local.google_notif_url
}

output "rtdn_topic_for_play_console" {
  description = "Register this topic in Play Console > Monetization setup > RTDN (likely already set)."
  value       = local.rtdn_topic
}
