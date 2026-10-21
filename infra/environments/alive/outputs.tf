output "environment" {
  description = "Current environment"
  value       = var.environment
}

output "temp_s3_bucket" {
  description = "Temporary S3 Bucket Name"
  value       = module.s3.temp_bucket_id
}

output "temp_s3_bucket_arn" {
  description = "Temporary S3 Bucket ARN"
  value       = module.s3.temp_bucket_arn
}

output "prod_s3_bucket" {
  description = "Production S3 Bucket Name"
  value       = module.s3.prod_bucket_id
}

output "prod_s3_bucket_arn" {
  description = "Production S3 Bucket ARN"
  value       = module.s3.prod_bucket_arn
}
