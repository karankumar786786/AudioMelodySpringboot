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

output "secret_arns" {
  description = "Secrets Manager secret name => ARN (containers only; values are set by hand, see infra/SECRETS.md)"
  value       = module.secrets.secret_arns
}

output "server_instance_profiles" {
  description = "IAM instance profile attached to each EC2 server"
  value       = module.secrets.instance_profile_names
}

output "kafka" {
  description = "Where the core API finds Kafka: the processing instance's private IP"
  value = {
    private_ip          = module.compute.ec2_processing_private_ip
    bootstrap_servers   = "${module.compute.ec2_processing_private_ip}:9092"
    schema_registry_url = "http://${module.compute.ec2_processing_private_ip}:8081"
    volume_id           = module.compute.kafka_volume_id
  }
}

output "lake_bucket" {
  description = "S3 data lake bucket (raw events as Parquet)"
  value       = module.lake.bucket_name
}
