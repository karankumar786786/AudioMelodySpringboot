variable "aws_region" {
  type        = string
  description = "AWS Region to deploy resources"
  default     = "ap-south-1"
}

variable "project_name" {
  type        = string
  description = "Project name used for naming and tagging"
  default     = "audiomelody"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "production"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "public_subnet_1_cidr" {
  type        = string
  description = "CIDR block for public subnet 1 (ap-south-1a)"
  default     = "10.0.1.0/24"
}

variable "public_subnet_2_cidr" {
  type        = string
  description = "CIDR block for public subnet 2 (ap-south-1b)"
  default     = "10.0.2.0/24"
}

variable "instance_count" {
  type        = number
  description = "Number of EC2 instances to launch"
  default     = 2
}

variable "instance_type" {
  type        = string
  description = "Comma-separated instance types for core and processing EC2 instances (in order: core, processing). Example: 't3.micro,t3.small'"
  default     = "t3.micro,t3.small"
}

variable "ami_id" {
  type        = string
  description = "Custom AMI ID. If left empty, latest Ubuntu 24.04 LTS AMI will be used."
  default     = ""
}

variable "root_volume_size" {
  type        = number
  description = "Size of the root EBS volume in GB"
  default     = 20
}

variable "root_volume_type" {
  type        = string
  description = "EBS volume type for root device"
  default     = "gp3"
}

variable "key_name" {
  type        = string
  description = "Name of the AWS Key Pair used for both EC2 instances"
  default     = "audiomelody-ec2-key"
}

variable "public_key" {
  type        = string
  description = "Optional SSH public key string. If left blank, a TLS private key and local .pem/.pub files will be generated automatically."
  default     = ""
}

variable "allowed_ssh_cidr_blocks" {
  type        = list(string)
  description = "List of CIDR blocks allowed for SSH access (port 22)"
  default     = ["0.0.0.0/0"]
}

variable "allowed_http_cidr_blocks" {
  type        = list(string)
  description = "List of CIDR blocks allowed for HTTP/HTTPS access"
  default     = ["0.0.0.0/0"]
}

variable "app_port" {
  type        = number
  description = "Application port (e.g. Spring Boot 8080)"
  default     = 8080
}

variable "allowed_app_cidr_blocks" {
  type        = list(string)
  description = "List of CIDR blocks allowed for application port access"
  default     = ["0.0.0.0/0"]
}
