# Low-fixed-cost WebSocket host shared by Corpan City and Teletron.
#
# A direct t4g.micro + Caddy avoids the fixed Application Load Balancer charge.
# The instance pulls the private ECR image through an IAM role and terminates TLS
# at a stable sslip.io hostname derived from its Elastic IP.

variable "enable_presence_ec2" {
  type        = bool
  description = "Provision the shared direct-EC2 WebSocket presence host."
  default     = false
}

variable "presence_ec2_instance_type" {
  type        = string
  description = "Small ARM instance for the shared presence process."
  default     = "t4g.micro"
}

data "aws_vpc" "default" {
  count   = var.enable_presence_ec2 ? 1 : 0
  default = true
}

data "aws_subnets" "default" {
  count = var.enable_presence_ec2 ? 1 : 0
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default[0].id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_ami" "al2023_arm64" {
  count       = var.enable_presence_ec2 ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }
  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_eip" "presence" {
  count  = var.enable_presence_ec2 ? 1 : 0
  domain = "vpc"

  tags = {
    Project   = var.project_name
    Component = "shared-presence-server"
  }
}

locals {
  presence_hostname = var.enable_presence_ec2 ? "presence.${replace(aws_eip.presence[0].public_ip, ".", "-")}.sslip.io" : ""
}

resource "aws_security_group" "presence" {
  count       = var.enable_presence_ec2 ? 1 : 0
  name        = "${var.project_name}-presence"
  description = "Public HTTPS/WebSocket ingress for the shared presence server"
  vpc_id      = data.aws_vpc.default[0].id

  ingress {
    description = "ACME HTTP challenge and redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS and secure WebSockets"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Project   = var.project_name
    Component = "shared-presence-server"
  }
}

data "aws_iam_policy_document" "presence_assume" {
  count = var.enable_presence_ec2 ? 1 : 0
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "presence_ecr" {
  count = var.enable_presence_ec2 ? 1 : 0
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [aws_ecr_repository.plaza_server[0].arn]
  }
}

resource "aws_iam_role" "presence" {
  count              = var.enable_presence_ec2 ? 1 : 0
  name               = "${var.project_name}-presence-ec2"
  assume_role_policy = data.aws_iam_policy_document.presence_assume[0].json

  tags = {
    Project   = var.project_name
    Component = "shared-presence-server"
  }
}

resource "aws_iam_role_policy" "presence_ecr" {
  count  = var.enable_presence_ec2 ? 1 : 0
  name   = "${var.project_name}-presence-ecr-pull"
  role   = aws_iam_role.presence[0].id
  policy = data.aws_iam_policy_document.presence_ecr[0].json
}

resource "aws_iam_role_policy_attachment" "presence_ssm" {
  count      = var.enable_presence_ec2 ? 1 : 0
  role       = aws_iam_role.presence[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "presence" {
  count = var.enable_presence_ec2 ? 1 : 0
  name  = "${var.project_name}-presence-ec2"
  role  = aws_iam_role.presence[0].name
}

resource "aws_instance" "presence" {
  count                       = var.enable_presence_ec2 ? 1 : 0
  ami                         = data.aws_ami.al2023_arm64[0].id
  instance_type               = var.presence_ec2_instance_type
  subnet_id                   = sort(data.aws_subnets.default[0].ids)[0]
  vpc_security_group_ids      = [aws_security_group.presence[0].id]
  iam_instance_profile        = aws_iam_instance_profile.presence[0].name
  associate_public_ip_address = true
  # Server image releases are deployed in place; changing the bootstrap script
  # must not replace the always-warm presence host and disconnect every socket.
  user_data_replace_on_change = false

  # The presence host is replaced only on purpose (DNS encodes its IP, sockets
  # are long-lived). AL2023 AMI rolls would otherwise force-replace it.
  lifecycle {
    ignore_changes = [ami]
  }

  credit_specification {
    cpu_credits = "standard"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  user_data = <<-USERDATA
    #!/bin/bash
    set -euxo pipefail
    dnf install -y docker awscli
    systemctl enable --now docker

    mkdir -p /opt/corpan-presence/caddy-data /opt/corpan-presence/caddy-config
    cat >/opt/corpan-presence/Caddyfile <<'CADDY'
    ${local.presence_hostname} {
      reverse_proxy 127.0.0.1:8080
    }
    CADDY

    aws ecr get-login-password --region ${var.aws_region} | \
      docker login --username AWS --password-stdin ${aws_ecr_repository.plaza_server[0].repository_url}
    docker pull ${aws_ecr_repository.plaza_server[0].repository_url}:${var.plaza_server_image_tag}
    docker run -d --restart unless-stopped --name corpan-presence-server \
      -p 127.0.0.1:8080:8080 \
      ${aws_ecr_repository.plaza_server[0].repository_url}:${var.plaza_server_image_tag}
    docker run -d --restart unless-stopped --name caddy \
      -p 80:80 -p 443:443 \
      -v /opt/corpan-presence/Caddyfile:/etc/caddy/Caddyfile:ro \
      -v /opt/corpan-presence/caddy-data:/data \
      -v /opt/corpan-presence/caddy-config:/config \
      caddy:2-alpine
  USERDATA

  depends_on = [
    aws_iam_role_policy.presence_ecr,
    aws_iam_role_policy_attachment.presence_ssm,
  ]

  tags = {
    Name      = "${var.project_name}-presence"
    Project   = var.project_name
    Component = "shared-presence-server"
  }
}

resource "aws_eip_association" "presence" {
  count         = var.enable_presence_ec2 ? 1 : 0
  instance_id   = aws_instance.presence[0].id
  allocation_id = aws_eip.presence[0].id
}

output "presence_server_url" {
  value       = var.enable_presence_ec2 ? "https://${local.presence_hostname}" : ""
  description = "Shared HTTP endpoint for health and Colyseus matchmaking."
}

output "presence_server_wss_url" {
  value       = var.enable_presence_ec2 ? "wss://${local.presence_hostname}" : ""
  description = "Shared secure WebSocket endpoint for Corpan City and Teletron."
}
