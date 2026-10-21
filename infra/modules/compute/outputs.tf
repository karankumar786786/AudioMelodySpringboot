output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

output "security_group_id" {
  description = "ID of the EC2 security group"
  value       = aws_security_group.ec2_sg.id
}

output "key_name" {
  description = "Key pair name used for both EC2 instances"
  value       = aws_key_pair.main.key_name
}

output "private_key_file" {
  description = "Local path to the private key file (.pem)"
  value       = "${path.root}/${var.key_name}.pem"
}

output "public_key_file" {
  description = "Local path to the public key file (.pub)"
  value       = "${path.root}/${var.key_name}.pub"
}

output "ec2_instance_ids" {
  description = "IDs of the EC2 instances in order (0: core, 1: processing)"
  value       = aws_instance.ec2[*].id
}

output "elastic_ips" {
  description = "Elastic IP addresses attached to the EC2 instances in order (0: core, 1: processing)"
  value       = aws_eip.ec2_eip[*].public_ip
}

output "ec2_core_instance_id" {
  description = "ID of the core EC2 instance"
  value       = aws_instance.ec2[0].id
}

output "ec2_core_elastic_ip" {
  description = "Elastic IP attached to the core EC2 instance"
  value       = aws_eip.ec2_eip[0].public_ip
}

output "ec2_processing_instance_id" {
  description = "ID of the processing EC2 instance"
  value       = aws_instance.ec2[1].id
}

output "ec2_processing_elastic_ip" {
  description = "Elastic IP attached to the processing EC2 instance"
  value       = aws_eip.ec2_eip[1].public_ip
}
