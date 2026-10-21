output "temp_bucket_id" {
  description = "Name/ID of the temporary S3 bucket"
  value       = aws_s3_bucket.temp.id
}

output "temp_bucket_arn" {
  description = "ARN of the temporary S3 bucket"
  value       = aws_s3_bucket.temp.arn
}

output "prod_bucket_id" {
  description = "Name/ID of the production S3 bucket"
  value       = aws_s3_bucket.prod.id
}

output "prod_bucket_arn" {
  description = "ARN of the production S3 bucket"
  value       = aws_s3_bucket.prod.arn
}
