# Sirf secret ke *dabbe* (containers) banata hai. Values alag se
# `aws secretsmanager put-secret-value` se likhi jaati hain (infra/SECRETS.md), taaki wo kabhi
# Terraform config, plans ya state me na aayein. Yahan aws_secretsmanager_secret_version MAT jodo.

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
# Har EC2 server ka ek IAM role + instance profile. Har server sirf runtime_environment ke apne
# secrets padh sakta hai; kahin bhi access keys nahi hain.

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
