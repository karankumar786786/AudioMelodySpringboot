# Secret *containers* only. Values are written out-of-band with
# `aws secretsmanager put-secret-value` (see infra/SECRETS.md), so they never
# appear in Terraform config, plans or state. Do not add aws_secretsmanager_secret_version here.

locals {
  secrets = {
    for pair in setproduct(var.secret_environments, var.secret_names) :
    "${pair[0]}/${pair[1]}" => {
      environment = pair[0]
      name        = pair[1]
    }
  }
}

resource "aws_secretsmanager_secret" "this" {
  for_each = local.secrets

  name                    = "${var.secret_prefix}/${each.key}"
  description             = "One Melody ${each.value.name} settings (${each.value.environment}). JSON object of env-var keys; see infra/SECRETS.md."
  recovery_window_in_days = var.recovery_window_in_days

  tags = {
    SecretEnvironment = each.value.environment
    SecretGroup       = each.value.name
  }
}

# ------------------------------------------------------------------------------
# One IAM role + instance profile per EC2 server. Each may read only its own
# secrets in runtime_environment; there are no access keys anywhere.
# ------------------------------------------------------------------------------

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "server" {
  for_each = var.server_secret_access

  name               = "${var.project_name}-${var.runtime_environment}-${each.key}-server"
  description        = "EC2 instance role for the ${each.key} server: reads its Secrets Manager secrets"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

data "aws_iam_policy_document" "read_secrets" {
  for_each = var.server_secret_access

  statement {
    sid     = "ReadOwnSecrets"
    actions = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [
      for name in each.value :
      aws_secretsmanager_secret.this["${var.runtime_environment}/${name}"].arn
    ]
  }
}

resource "aws_iam_role_policy" "read_secrets" {
  for_each = var.server_secret_access

  name   = "read-onemelody-secrets"
  role   = aws_iam_role.server[each.key].id
  policy = data.aws_iam_policy_document.read_secrets[each.key].json
}

resource "aws_iam_instance_profile" "server" {
  for_each = var.server_secret_access

  name = aws_iam_role.server[each.key].name
  role = aws_iam_role.server[each.key].name
}
