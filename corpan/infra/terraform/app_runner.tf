# ---------------------------------------------------------------------------
# World Plaza (Corpan City) — Colyseus presence server on AWS App Runner.
#
# App Runner runs the container from server/Dockerfile, terminates TLS for us
# (every service gets an HTTPS *.awsapprunner.com URL → the pack connects with
# wss://), autoscales, and health-checks. The server speaks bare WS on $PORT
# (8080 here); App Runner's HTTPS front handles wss upgrade transparently.
#
# Region / provider / backend all inherit the existing us-east-2 setup
# (provider.tf default aws provider, backend.tf S3 state). NOTHING here is
# applied by this CR — the integrator runs `terraform apply` with AWS creds.
# See packs/world-plaza/server/DEPLOY.md for the end-to-end runbook.
#
# Toggle: gated behind var.enable_plaza_server (default false) so it is inert
# until the integrator opts in with -var enable_plaza_server=true.
# ---------------------------------------------------------------------------

variable "enable_plaza_server" {
  type        = bool
  description = "Provision the World Plaza Colyseus server (ECR repo + App Runner service)."
  default     = false
}

variable "plaza_server_image_tag" {
  type        = string
  description = "ECR image tag App Runner deploys (push this tag before apply, e.g. a git SHA or 'latest')."
  default     = "latest"
}

variable "plaza_server_cpu" {
  type        = string
  description = "App Runner instance vCPU (e.g. \"0.25 vCPU\", \"0.5 vCPU\", \"1 vCPU\")."
  default     = "0.25 vCPU"
}

variable "plaza_server_memory" {
  type        = string
  description = "App Runner instance memory (e.g. \"0.5 GB\", \"1 GB\", \"2 GB\")."
  default     = "0.5 GB"
}

variable "plaza_server_max_concurrency" {
  type        = number
  description = "Max concurrent requests per instance before App Runner scales out."
  default     = 100
}

variable "plaza_server_min_size" {
  type        = number
  description = "Minimum provisioned instances (1 = always-warm; presence needs a live socket)."
  default     = 1
}

variable "plaza_server_max_size" {
  type        = number
  description = "Maximum instances App Runner may scale out to."
  default     = 3
}

# --- ECR repository the Dockerfile image is pushed to -----------------------

resource "aws_ecr_repository" "plaza_server" {
  count                = var.enable_plaza_server ? 1 : 0
  name                 = "${var.project_name}-plaza-server"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project   = var.project_name
    Component = "world-plaza-server"
  }
}

# Keep only recent images so the repo doesn't accrete every push forever.
resource "aws_ecr_lifecycle_policy" "plaza_server" {
  count      = var.enable_plaza_server ? 1 : 0
  repository = aws_ecr_repository.plaza_server[0].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

# --- IAM: App Runner's access role to PULL from the private ECR repo --------

data "aws_iam_policy_document" "apprunner_ecr_assume" {
  count = var.enable_plaza_server ? 1 : 0
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "plaza_apprunner_ecr_access" {
  count              = var.enable_plaza_server ? 1 : 0
  name               = "${var.project_name}-plaza-apprunner-ecr-access"
  assume_role_policy = data.aws_iam_policy_document.apprunner_ecr_assume[0].json

  tags = {
    Project   = var.project_name
    Component = "world-plaza-server"
  }
}

resource "aws_iam_role_policy_attachment" "plaza_apprunner_ecr_access" {
  count      = var.enable_plaza_server ? 1 : 0
  role       = aws_iam_role.plaza_apprunner_ecr_access[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# --- App Runner service ------------------------------------------------------

resource "aws_apprunner_service" "plaza_server" {
  count        = var.enable_plaza_server ? 1 : 0
  service_name = "${var.project_name}-plaza-server"

  source_configuration {
    # No secrets here: the server is stateless presence, no env credentials.
    auto_deployments_enabled = false

    authentication_configuration {
      access_role_arn = aws_iam_role.plaza_apprunner_ecr_access[0].arn
    }

    image_repository {
      image_repository_type = "ECR"
      image_identifier      = "${aws_ecr_repository.plaza_server[0].repository_url}:${var.plaza_server_image_tag}"

      image_configuration {
        port = "8080"
        runtime_environment_variables = {
          PORT = "8080"
        }
      }
    }
  }

  instance_configuration {
    cpu    = var.plaza_server_cpu
    memory = var.plaza_server_memory
  }

  health_check_configuration {
    # Colyseus serves the matchmake HTTP endpoint on the same port; TCP health
    # check just confirms the socket is up (no dedicated /health route needed).
    protocol            = "TCP"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.plaza_server[0].arn

  tags = {
    Project   = var.project_name
    Component = "world-plaza-server"
  }

  # The repo + image must exist before the service can pull it.
  depends_on = [
    aws_ecr_repository.plaza_server,
    aws_iam_role_policy_attachment.plaza_apprunner_ecr_access,
  ]
}

resource "aws_apprunner_auto_scaling_configuration_version" "plaza_server" {
  count                           = var.enable_plaza_server ? 1 : 0
  auto_scaling_configuration_name = "${var.project_name}-plaza-server"

  max_concurrency = var.plaza_server_max_concurrency
  min_size        = var.plaza_server_min_size
  max_size        = var.plaza_server_max_size

  tags = {
    Project   = var.project_name
    Component = "world-plaza-server"
  }
}

# --- Outputs -----------------------------------------------------------------

output "plaza_server_url" {
  value       = var.enable_plaza_server ? "https://${aws_apprunner_service.plaza_server[0].service_url}" : ""
  description = "App Runner HTTPS URL for the plaza server. The pack connects with the wss:// equivalent (swap https→wss). Bake into VITE_WP_SERVER_URL."
}

output "plaza_server_wss_url" {
  value       = var.enable_plaza_server ? "wss://${aws_apprunner_service.plaza_server[0].service_url}" : ""
  description = "Ready-to-use wss:// URL for VITE_WP_SERVER_URL / __WP_SERVER_URL / ?wpServer=."
}

output "plaza_server_ecr_repository_url" {
  value       = var.enable_plaza_server ? aws_ecr_repository.plaza_server[0].repository_url : ""
  description = "ECR repository URL to docker tag/push the server image to before apply."
}
