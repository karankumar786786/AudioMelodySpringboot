output "secret_arns" {
  description = "Secret name => ARN"
  value       = { for k, s in aws_secretsmanager_secret.this : s.name => s.arn }
}

output "instance_profile_names" {
  description = "Server role (core, processing) => IAM instance profile name"
  value       = { for k, p in aws_iam_instance_profile.server : k => p.name }
}

output "role_arns" {
  description = "Server role (core, processing) => IAM role ARN"
  value       = { for k, r in aws_iam_role.server : k => r.arn }
}
