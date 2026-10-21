output "environment" {
  description = "Current environment"
  value       = var.environment
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.compute.vpc_id
}

output "public_subnet_ids" {
  description = "Public Subnet IDs"
  value       = module.compute.public_subnet_ids
}

output "security_group_id" {
  description = "Security Group ID for EC2 instances"
  value       = module.compute.security_group_id
}

output "key_name" {
  description = "Shared Key Pair Name used for both EC2 instances"
  value       = module.compute.key_name
}

output "private_key_pem_file" {
  description = "Path to the private key (.pem) file"
  value       = module.compute.private_key_file
}

output "public_key_file" {
  description = "Path to the public key (.pub) file"
  value       = module.compute.public_key_file
}

output "ec2_instance_ids" {
  description = "IDs of the 2 EC2 instances in order (0: core, 1: processing)"
  value       = module.compute.ec2_instance_ids
}

output "elastic_ips" {
  description = "Elastic IPs associated with the EC2 instances in order (0: core, 1: processing)"
  value       = module.compute.elastic_ips
}

output "core_instance" {
  description = "Core EC2 instance details"
  value = {
    instance_id = module.compute.ec2_core_instance_id
    elastic_ip  = module.compute.ec2_core_elastic_ip
    ssh_command = "ssh -i ${module.compute.key_name}.pem ubuntu@${module.compute.ec2_core_elastic_ip}"
  }
}

output "processing_instance" {
  description = "Processing EC2 instance details"
  value = {
    instance_id = module.compute.ec2_processing_instance_id
    elastic_ip  = module.compute.ec2_processing_elastic_ip
    ssh_command = "ssh -i ${module.compute.key_name}.pem ubuntu@${module.compute.ec2_processing_elastic_ip}"
  }
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
