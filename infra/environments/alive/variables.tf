variable "aws_region" {
  type        = string
  description = "AWS Region to deploy resources"
  default     = "ap-south-1"
}

variable "project_name" {
  type        = string
  description = "Project identifier used in naming and tags"
  default     = "audiomelody"
}

variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "alive"
}

variable "temp_bucket_name" {
  type        = string
  description = "Globally unique name for the temporary S3 bucket"
  default     = "audiomelody-temp-storage-alive-oneorg"
}

variable "prod_bucket_name" {
  type        = string
  description = "Globally unique name for the production S3 bucket"
  default     = "audiomelody-prod-storage-alive-oneorg"
}

variable "temp_bucket_expiration_days" {
  type        = number
  description = "Number of days before temporary S3 objects expire"
  default     = 7
}

variable "is_public" {
  type        = bool
  description = "Whether both buckets should be completely public"
  default     = true
}
