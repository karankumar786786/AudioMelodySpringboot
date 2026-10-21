output "vpc_id" {
  description = "VPC ID"
  value       = module.resources.vpc_id
}

output "security_group_id" {
  description = "Security Group ID for EC2 instances"
  value       = module.resources.security_group_id
}

output "key_name" {
  description = "Shared Key Pair Name used for both EC2 instances"
  value       = module.resources.key_name
}

output "private_key_pem_file" {
  description = "Path to the private key (.pem) file"
  value       = module.resources.private_key_file
}

output "public_key_file" {
  description = "Path to the public key (.pub) file"
  value       = module.resources.public_key_file
}

output "ec2_instance_ids" {
  description = "IDs of the 2 EC2 instances in order (0: core, 1: processing)"
  value       = module.resources.ec2_instance_ids
}

output "elastic_ips" {
  description = "Elastic IPs associated with the EC2 instances in order (0: core, 1: processing)"
  value       = module.resources.elastic_ips
}

output "core_instance" {
  description = "Core EC2 instance details"
  value = {
    instance_id = module.resources.ec2_core_instance_id
    elastic_ip  = module.resources.ec2_core_elastic_ip
    ssh_command = "ssh -i ${module.resources.key_name}.pem ubuntu@${module.resources.ec2_core_elastic_ip}"
  }
}

output "processing_instance" {
  description = "Processing EC2 instance details"
  value = {
    instance_id = module.resources.ec2_processing_instance_id
    elastic_ip  = module.resources.ec2_processing_elastic_ip
    ssh_command = "ssh -i ${module.resources.key_name}.pem ubuntu@${module.resources.ec2_processing_elastic_ip}"
  }
}

output "temp_s3_bucket" {
  description = "Temporary S3 Bucket Name"
  value       = module.resources.temp_bucket_name
}

output "prod_s3_bucket" {
  description = "Production S3 Bucket Name"
  value       = module.resources.prod_bucket_name
}
