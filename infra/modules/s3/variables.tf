variable "project_name" {
  type        = string
  description = "Project identifier used in resource naming and tags"
  default     = "audiomelody"
}

variable "environment" {
  type        = string
  description = "Target deployment environment (e.g. alive, production)"
  default     = "alive"
}

variable "temp_bucket_name" {
  type        = string
  description = "Globally unique name for the temporary S3 bucket"
}

variable "prod_bucket_name" {
  type        = string
  description = "Globally unique name for the production S3 bucket"
}

variable "temp_bucket_expiration_days" {
  type        = number
  description = "Number of days before temporary S3 objects expire"
  default     = 7
}

variable "is_public" {
  type        = bool
  description = "Whether to configure both buckets for complete public access"
  default     = false
}
